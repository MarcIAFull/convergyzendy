import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { buildOrchestratorPrompt } from './orchestrator-prompt.ts';
import { buildConversationalAIPrompt } from './conversational-ai-prompt.ts';
import { sendWhatsAppMessage } from '../_shared/evolutionClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, customerPhone, restaurantId } = await req.json();
    const messageBody = message.toLowerCase().trim();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[WhatsApp AI] Processing message from ${customerPhone}`);
    console.log(`[WhatsApp AI] Message: "${message}"`);
    console.log(`${'='.repeat(60)}\n`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============================================================
    // STEP 1: LOAD CONTEXT
    // ============================================================
    
    // Load restaurant
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (!restaurant) throw new Error('Restaurant not found');

    // Load menu with products
    const { data: categories } = await supabase
      .from('categories')
      .select(`
        id, name, sort_order,
        products!inner (
          id, name, description, price, is_available,
          addons (id, name, price)
        )
      `)
      .eq('restaurant_id', restaurantId)
      .eq('products.is_available', true)
      .order('sort_order');

    const availableProducts = categories?.flatMap(cat => 
      cat.products?.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        category: cat.name,
        addons: p.addons || []
      })) || []
    ) || [];

    console.log(`[Context] Loaded ${availableProducts.length} products`);

    // Load conversation history (last 10 messages)
    const { data: messageHistory } = await supabase
      .from('messages')
      .select('body, direction, timestamp')
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${customerPhone},to_number.eq.${customerPhone}`)
      .order('timestamp', { ascending: false })
      .limit(10);

    const conversationHistory = (messageHistory || []).reverse().map(msg => ({
      role: msg.direction === 'incoming' ? 'user' : 'assistant',
      content: msg.body
    }));

    // Load active cart
    const { data: activeCarts } = await supabase
      .from('carts')
      .select(`
        id, status, created_at,
        cart_items (
          id, quantity, notes, product_id,
          products (id, name, price)
        )
      `)
      .eq('restaurant_id', restaurantId)
      .eq('user_phone', customerPhone)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    let activeCart = activeCarts?.[0] || null;
    const cartItems = activeCart?.cart_items?.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.products.name,
      quantity: item.quantity,
      price: item.products.price,
      total_price: item.quantity * item.products.price,
      notes: item.notes
    })) || [];

    const cartTotal = cartItems.reduce((sum: number, item: any) => sum + item.total_price, 0);

    console.log(`[Context] Cart: ${cartItems.length} items, Total: €${cartTotal}`);

    // Load/create conversation state
    let { data: conversationState } = await supabase
      .from('conversation_state')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('user_phone', customerPhone)
      .maybeSingle();

    if (!conversationState) {
      const { data: newState } = await supabase
        .from('conversation_state')
        .insert({
          restaurant_id: restaurantId,
          user_phone: customerPhone,
          state: 'idle',
          cart_id: activeCart?.id || null
        })
        .select()
        .single();
      conversationState = newState;
    }

    const currentState = conversationState?.state || 'idle';
    const stateMetadata = conversationState?.metadata || {};

    console.log(`[Context] Current state: ${currentState}`);

    // ============================================================
    // STEP 2: CALL ORDER ORCHESTRATOR
    // ============================================================
    
    console.log('\n[Orchestrator] ========== CALLING ORCHESTRATOR ==========');
    
    const orchestratorPrompt = buildOrchestratorPrompt({
      currentState,
      cartItems,
      cartTotal,
      menuProducts: availableProducts,
      pendingProduct: stateMetadata.pending_product || null,
      lastShownProduct: stateMetadata.last_shown_product || null,
      restaurantName: restaurant.name,
      conversationHistory
    });

    const orchestratorResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: orchestratorPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.0,
        response_format: { type: "json_object" }
      }),
    });

    if (!orchestratorResponse.ok) {
      const errorText = await orchestratorResponse.text();
      console.error('[Orchestrator] Error:', errorText);
      throw new Error(`Orchestrator failed: ${orchestratorResponse.status}`);
    }

    const orchestratorData = await orchestratorResponse.json();
    const decision = JSON.parse(orchestratorData.choices[0].message.content);
    
    console.log('[Orchestrator] Decision:', JSON.stringify(decision, null, 2));

    // ============================================================
    // STEP 3: EXECUTE ORCHESTRATOR DECISION
    // ============================================================
    
    let finalResponse = '';
    let newState = currentState;
    let newMetadata = { ...stateMetadata };

    switch (decision.action) {
      case 'show_menu': {
        console.log('[Action] → SHOW_MENU');
        const menuText = categories?.map(cat => {
          const prods = cat.products?.map((p: any) => 
            `  • ${p.name} - €${p.price}${p.description ? `\n    ${p.description}` : ''}`
          ).join('\n');
          return `*${cat.name}*\n${prods}`;
        }).join('\n\n');
        
        finalResponse = `📋 *Menu - ${restaurant.name}*\n\n${menuText}\n\nQue produto te interessa?`;
        newState = 'browsing_menu';
        break;
      }

      case 'add_to_cart': {
        console.log('[Action] → ADD_TO_CART');
        const productId = decision.product_id;
        const quantity = decision.quantity || 1;

        if (!productId) {
          finalResponse = 'Desculpa, não consegui identificar o produto. Qual produto queres?';
          break;
        }

        const product = availableProducts.find(p => p.id === productId);
        if (!product) {
          finalResponse = 'Esse produto não está disponível.';
          break;
        }

        // Create cart if needed
        if (!activeCart) {
          const { data: newCart } = await supabase
            .from('carts')
            .insert({
              restaurant_id: restaurantId,
              user_phone: customerPhone,
              status: 'active'
            })
            .select()
            .single();
          activeCart = newCart;
        }

        // Add item to cart
        const { error: addError } = await supabase
          .from('cart_items')
          .insert({
            cart_id: activeCart!.id,
            product_id: productId,
            quantity,
            notes: decision.notes
          });

        if (addError) {
          console.error('[Action] Add to cart error:', addError);
          finalResponse = `❌ Erro ao adicionar produto: ${addError.message}`;
        } else {
          const newTotal = cartTotal + (product.price * quantity);
          finalResponse = `✅ Adicionei ${quantity}x ${product.name} ao teu pedido!\n\n💰 Total: €${newTotal.toFixed(2)}\n\nQueres adicionar mais algo ou finalizar?`;
          newState = 'confirming_item';
          newMetadata.pending_product = null; // Clear pending
        }
        break;
      }

      case 'remove_from_cart': {
        console.log('[Action] → REMOVE_FROM_CART');
        const productId = decision.product_id;

        if (!productId || !activeCart) {
          finalResponse = 'Não há nada para remover.';
          break;
        }

        const { error: removeError } = await supabase
          .from('cart_items')
          .delete()
          .eq('cart_id', activeCart.id)
          .eq('product_id', productId);

        if (removeError) {
          finalResponse = `❌ Erro ao remover: ${removeError.message}`;
        } else {
          const product = availableProducts.find(p => p.id === productId);
          const newTotal = cartTotal - (product?.price || 0);
          finalResponse = `✅ Removi ${product?.name} do carrinho.\n\n💰 Total: €${newTotal.toFixed(2)}`;
        }
        break;
      }

      case 'set_delivery_address': {
        console.log('[Action] → SET_DELIVERY_ADDRESS');
        const address = decision.address;

        if (!address) {
          finalResponse = 'Por favor, fornece o teu endereço de entrega.';
          break;
        }

        newMetadata.delivery_address = address;
        newState = 'collecting_payment';
        
        finalResponse = `✅ Endereço registado: ${address}\n\nComo preferes pagar?\n1. 💵 Dinheiro\n2. 💳 Multibanco\n3. 📱 MBWay`;
        break;
      }

      case 'set_payment_method': {
        console.log('[Action] → SET_PAYMENT_METHOD');
        const paymentMethod = decision.payment_method;

        if (!paymentMethod) {
          finalResponse = 'Por favor, escolhe: Dinheiro, Multibanco ou MBWay.';
          break;
        }

        newMetadata.payment_method = paymentMethod;
        newState = 'ready_to_order';

        const orderSummary = cartItems.map((item: any) => 
          `${item.quantity}x ${item.product_name} - €${item.total_price.toFixed(2)}`
        ).join('\n');

        finalResponse = `✅ Método: ${paymentMethod}\n\n📦 *Resumo do Pedido*\n${orderSummary}\n\n💰 Total: €${cartTotal.toFixed(2)}\n🚚 Entrega: ${newMetadata.delivery_address}\n\nConfirmas?`;
        break;
      }

      case 'finalize_order': {
        console.log('[Action] → FINALIZE_ORDER');

        if (!newMetadata.delivery_address || !newMetadata.payment_method) {
          finalResponse = '❌ Falta informação. Preciso do endereço e forma de pagamento.';
          break;
        }

        if (!activeCart || cartItems.length === 0) {
          finalResponse = '❌ O carrinho está vazio.';
          break;
        }

        // Create order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            restaurant_id: restaurantId,
            user_phone: customerPhone,
            cart_id: activeCart!.id,
            delivery_address: newMetadata.delivery_address,
            payment_method: newMetadata.payment_method,
            total_amount: cartTotal,
            status: 'pending'
          })
          .select()
          .single();

        if (orderError) {
          console.error('[Action] Order creation error:', orderError);
          finalResponse = `❌ Erro ao criar pedido: ${orderError.message}`;
        } else {
          // Mark cart as converted
          await supabase
            .from('carts')
            .update({ status: 'converted' })
            .eq('id', activeCart!.id);

          finalResponse = `🎉 *Pedido Confirmado!*\n\nNúmero: #${order.id.slice(0, 8)}\n💰 Total: €${cartTotal.toFixed(2)}\n🚚 Entrega: ${newMetadata.delivery_address}\n💳 Pagamento: ${newMetadata.payment_method}\n\nO teu pedido será entregue em breve!`;
          newState = 'idle';
          newMetadata = {}; // Clear metadata
        }
        break;
      }

      case 'ask_clarification': {
        console.log('[Action] → ASK_CLARIFICATION');
        finalResponse = 'Desculpa, não percebi bem. Podes ser mais específico?';
        break;
      }

      case 'delegate_to_ai': {
        console.log('[Action] → DELEGATE_TO_AI');
        
        // Call conversational AI (NO TOOLS)
        const conversationalPrompt = buildConversationalAIPrompt({
          restaurantName: restaurant.name,
          menuProducts: availableProducts,
          cartItems,
          cartTotal,
          currentState
        });

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: conversationalPrompt },
              ...conversationHistory.slice(-6),
              { role: 'user', content: message }
            ],
            temperature: 0.7
          }),
        });

        if (!aiResponse.ok) {
          throw new Error(`AI failed: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        finalResponse = aiData.choices[0].message.content;

        // Check if AI mentioned a product - mark it as pending
        const mentionedProduct = availableProducts.find(p => 
          finalResponse.toLowerCase().includes(p.name.toLowerCase())
        );

        if (mentionedProduct) {
          console.log('[AI] Product mentioned:', mentionedProduct.name);
          newMetadata.pending_product = mentionedProduct;
          newMetadata.last_shown_product = mentionedProduct;
        }
        break;
      }

      default:
        finalResponse = 'Desculpa, ocorreu um erro. Podes repetir?';
    }

    // ============================================================
    // STEP 4: UPDATE STATE & SEND RESPONSE
    // ============================================================
    
    // Update conversation state
    await supabase
      .from('conversation_state')
      .update({
        state: newState,
        cart_id: activeCart?.id || null,
        metadata: newMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationState!.id);

    console.log(`[State] Updated: ${currentState} → ${newState}`);

    // Save message to database
    await supabase
      .from('messages')
      .insert([
        {
          restaurant_id: restaurantId,
          from_number: customerPhone,
          to_number: restaurant.phone,
          body: message,
          direction: 'incoming'
        },
        {
          restaurant_id: restaurantId,
          from_number: restaurant.phone,
          to_number: customerPhone,
          body: finalResponse,
          direction: 'outgoing'
        }
      ]);

    // Send WhatsApp response
    await sendWhatsAppMessage(customerPhone, finalResponse);

    console.log(`[WhatsApp AI] ✅ Response sent\n`);

    return new Response(
      JSON.stringify({ success: true, response: finalResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[WhatsApp AI] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
