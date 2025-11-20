import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { buildOrchestratorPrompt } from './orchestrator-prompt.ts';
import { buildConversationalAIPrompt } from './conversational-ai-prompt.ts';
import { detectOfferedProduct } from './product-detection.ts';
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
    const startTime = Date.now();
    
    const { messageBody: rawMessage, customerPhone, restaurantId } = await req.json();
    const messageBody = rawMessage?.toLowerCase().trim() || '';

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[WhatsApp AI] ========== NEW MESSAGE RECEIVED ==========`);
    console.log(`[WhatsApp AI] From: ${customerPhone}`);
    console.log(`[WhatsApp AI] Restaurant ID: ${restaurantId}`);
    console.log(`[WhatsApp AI] Message: "${rawMessage}"`);
    console.log(`[WhatsApp AI] Timestamp: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}\n`);

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
    const pendingProduct = stateMetadata.pending_product || null;
    const lastShownProduct = stateMetadata.last_shown_product || null;

    // ============================================================
    // CONTEXT VALIDATION & LOGGING
    // ============================================================
    
    console.log('\n[Context] ========== CONTEXT VALIDATION ==========');
    console.log(`[Context] User message: "${rawMessage}"`);
    console.log(`[Context] History length: ${conversationHistory.length} messages`);
    console.log(`[Context] Current state: ${currentState}`);
    console.log(`[Context] Pending product: ${pendingProduct ? `${pendingProduct.name} (ID: ${pendingProduct.id})` : 'None'}`);
    console.log(`[Context] Last shown product: ${lastShownProduct ? `${lastShownProduct.name} (ID: ${lastShownProduct.id})` : 'None'}`);
    console.log(`[Context] Cart items: ${cartItems.length} items, Total: €${cartTotal.toFixed(2)}`);
    console.log(`[Context] Available products: ${availableProducts.length}`);
    
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-3);
      console.log(`[Context] Recent conversation (last 3):`);
      recentHistory.forEach((msg, idx) => {
        const role = msg.role === 'user' ? 'Customer' : 'Agent';
        const preview = msg.content.substring(0, 60);
        console.log(`[Context]   ${idx + 1}. ${role}: "${preview}${msg.content.length > 60 ? '...' : ''}"`);
      });
    }
    
    console.log('[Context] ===========================================\n');

    // ============================================================
    // STEP 2: CALL ORDER ORCHESTRATOR
    // ============================================================
    
    console.log('[Orchestrator] ========== CALLING ORCHESTRATOR ==========');
    console.log('[Orchestrator] Context being passed:');
    console.log(`[Orchestrator]   - History: ${conversationHistory.length} messages (FULL)`);
    console.log(`[Orchestrator]   - State: ${currentState}`);
    console.log(`[Orchestrator]   - Pending: ${pendingProduct?.name || 'None'}`);
    console.log(`[Orchestrator]   - Cart: ${cartItems.length} items`);
    
    const orchestratorPrompt = buildOrchestratorPrompt({
      userMessage: rawMessage,
      currentState,
      cartItems,
      cartTotal,
      menuProducts: availableProducts,
      pendingProduct: pendingProduct,
      lastShownProduct: lastShownProduct,
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
          { role: 'user', content: "Analyze the context and return the intent JSON only." }
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
    
    console.log('[Orchestrator] Intent Classification:', JSON.stringify(decision, null, 2));
    console.log(`[Orchestrator] → Intent: ${decision.intent}`);
    console.log(`[Orchestrator] → Target State: ${decision.target_state}`);
    console.log(`[Orchestrator] → Confidence: ${decision.confidence}`);
    console.log(`[Orchestrator] → Reasoning: ${decision.reasoning}`);

    // ============================================================
    // STEP 3: CALL MAIN AI WITH TOOLS
    // ============================================================
    
    console.log('\n[Main AI] ========== CALLING MAIN AI WITH TOOLS ==========');
    
    const { intent, target_state: targetState, confidence } = decision;
    
    console.log('[Main AI] Context being passed:');
    console.log(`[Main AI]   - History: ${conversationHistory.length} messages (FULL - SAME AS ORCHESTRATOR)`);
    console.log(`[Main AI]   - State: ${currentState}`);
    console.log(`[Main AI]   - Target State: ${targetState}`);
    console.log(`[Main AI]   - Intent: ${intent}`);
    console.log(`[Main AI]   - Pending: ${pendingProduct?.name || 'None'}`);
    console.log(`[Main AI]   - Cart: ${cartItems.length} items`);
    
    // Define tool schemas
    const tools = [
      {
        type: "function",
        function: {
          name: "add_to_cart",
          description: "Add a product to the customer's cart",
          parameters: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "UUID of the product to add (from the product list)"
              },
              quantity: {
                type: "number",
                description: "Quantity to add, default 1"
              },
              notes: {
                type: "string",
                description: "Optional special instructions"
              }
            },
            required: ["product_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "remove_from_cart",
          description: "Remove a product from the customer's cart",
          parameters: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "UUID of the product to remove"
              }
            },
            required: ["product_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "set_delivery_address",
          description: "Set the delivery address for the order",
          parameters: {
            type: "object",
            properties: {
              address: {
                type: "string",
                description: "Full delivery address"
              }
            },
            required: ["address"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "set_payment_method",
          description: "Set the payment method for the order",
          parameters: {
            type: "object",
            properties: {
              method: {
                type: "string",
                enum: ["cash", "card", "mbway"],
                description: "Payment method"
              }
            },
            required: ["method"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "finalize_order",
          description: "Finalize and place the order",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      }
    ];
    
    // Build AI prompt with intent context
    const conversationalPrompt = buildConversationalAIPrompt({
      restaurantName: restaurant.name,
      menuProducts: availableProducts,
      cartItems,
      cartTotal,
      currentState,
      userIntent: intent,
      targetState
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
          ...conversationHistory,
          { role: 'user', content: rawMessage }
        ],
        tools,
        temperature: 0.7
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`Main AI failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices[0].message;
    let finalResponse = aiMessage.content || '';
    const toolCalls = aiMessage.tool_calls || [];
    
    console.log(`[Main AI] Response preview: "${finalResponse.substring(0, 100)}${finalResponse.length > 100 ? '...' : ''}"`);
    console.log(`[Main AI] Tool calls received: ${toolCalls.length}`);
    
    if (toolCalls.length > 0) {
      console.log('[Main AI] Tools to execute:');
      toolCalls.forEach((tc: any, idx: number) => {
        console.log(`[Main AI]   ${idx + 1}. ${tc.function.name}(${tc.function.arguments})`);
      });
    }
    
    // ============================================================
    // STEP 4: EXECUTE TOOL CALLS
    // ============================================================
    
    console.log('\n[Tool Execution] ========== EXECUTING TOOL CALLS ==========');
    
    let newState = targetState;
    let newMetadata = { ...stateMetadata };
    
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      
      console.log(`[Tool] ──────────────────────────────────────────────`);
      console.log(`[Tool] Executing: ${functionName}`);
      console.log(`[Tool] Arguments:`, JSON.stringify(args, null, 2));
      
      switch (functionName) {
        case 'add_to_cart': {
          const { product_id, quantity = 1, notes } = args;
          
          const product = availableProducts.find(p => p.id === product_id);
          if (!product) {
            console.error(`[Tool] Product not found: ${product_id}`);
            continue;
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
              product_id,
              quantity,
              notes
            });
          
          if (addError) {
            console.error('[Tool] Add to cart error:', addError);
          } else {
            console.log(`[Tool] ✅ Added ${quantity}x ${product.name} to cart`);
            newState = 'confirming_item';
            newMetadata.pending_product = null;
            newMetadata.last_shown_product = product;
          }
          break;
        }
        
        case 'remove_from_cart': {
          const { product_id } = args;
          
          if (!activeCart) {
            console.error('[Tool] No active cart');
            continue;
          }
          
          const { error: removeError } = await supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', activeCart.id)
            .eq('product_id', product_id);
          
          if (removeError) {
            console.error('[Tool] Remove error:', removeError);
          } else {
            console.log(`[Tool] ✅ Removed product from cart`);
          }
          break;
        }
        
        case 'set_delivery_address': {
          const { address } = args;
          
          newMetadata.delivery_address = address;
          newState = 'collecting_payment';
          console.log(`[Tool] ✅ Set delivery address: ${address}`);
          break;
        }
        
        case 'set_payment_method': {
          const { method } = args;
          
          newMetadata.payment_method = method;
          newState = 'ready_to_order';
          console.log(`[Tool] ✅ Set payment method: ${method}`);
          break;
        }
        
        case 'finalize_order': {
          if (!activeCart || cartItems.length === 0) {
            console.error('[Tool] Cannot finalize: empty cart');
            continue;
          }
          
          if (!newMetadata.delivery_address || !newMetadata.payment_method) {
            console.error('[Tool] Cannot finalize: missing address or payment');
            continue;
          }
          
          const orderTotal = cartItems.reduce((sum, item) => sum + item.total_price, 0);
          
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
              restaurant_id: restaurantId,
              user_phone: customerPhone,
              cart_id: activeCart.id,
              delivery_address: newMetadata.delivery_address,
              payment_method: newMetadata.payment_method,
              total_amount: orderTotal,
              status: 'new'
            })
            .select()
            .single();
          
          if (orderError) {
            console.error('[Tool] Order creation error:', orderError);
          } else {
            console.log(`[Tool] ✅ Order created: ${order.id}`);
            
            // Mark cart as converted
            await supabase
              .from('carts')
              .update({ status: 'converted' })
              .eq('id', activeCart.id);
            
            // Clear metadata
            newMetadata = {};
            newState = 'idle';
          }
          break;
        }
      }
    }
    
    // Detect if AI offered a product (for pending_product tracking)
    if (toolCalls.length === 0 && finalResponse) {
      const offeredProduct = detectOfferedProduct(finalResponse, availableProducts);
      
      if (offeredProduct) {
        console.log(`[Product Detection] Product offered: ${offeredProduct.name}`);
        newMetadata.pending_product = offeredProduct;
        newMetadata.last_shown_product = offeredProduct;
      } else {
        console.log('[Product Detection] No product offer detected in response');
      }
    }

    // ============================================================
    // STEP 5: UPDATE STATE & SEND RESPONSE
    // ============================================================
    
    console.log('\n[State Update] ========== UPDATING STATE ==========');
    console.log(`[State Update] State transition: ${currentState} → ${newState}`);
    console.log(`[State Update] Pending product: ${newMetadata.pending_product?.name || 'None'}`);
    console.log(`[State Update] Last shown product: ${newMetadata.last_shown_product?.name || 'None'}`);
    console.log(`[State Update] Delivery address: ${newMetadata.delivery_address || 'Not set'}`);
    console.log(`[State Update] Payment method: ${newMetadata.payment_method || 'Not set'}`);
    
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

    console.log(`[State Update] ✅ State updated successfully`);

    // Save message to database
    await supabase
      .from('messages')
      .insert([
        {
          restaurant_id: restaurantId,
          from_number: customerPhone,
          to_number: restaurant.phone,
          body: rawMessage,
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

    console.log('\n[Response] ========== SENDING RESPONSE ==========');
    console.log(`[Response] Final message: "${finalResponse.substring(0, 150)}${finalResponse.length > 150 ? '...' : ''}"`);
    console.log(`[Response] Message length: ${finalResponse.length} characters`);
    
    // Send WhatsApp response (non-blocking for test environments)
    try {
      await sendWhatsAppMessage(customerPhone, finalResponse);
      console.log(`[Response] ✅ WhatsApp message sent successfully`);
    } catch (whatsappError: any) {
      console.warn(`[Response] ⚠️ Failed to send WhatsApp (test mode?):`, whatsappError.message);
      // Continue anyway - AI processing succeeded
    }

    console.log('\n[Summary] ========== PROCESSING COMPLETE ==========');
    console.log(`[Summary] Intent classified: ${intent} (confidence: ${confidence})`);
    console.log(`[Summary] Tools executed: ${toolCalls.length}`);
    console.log(`[Summary] State transition: ${currentState} → ${newState}`);
    console.log(`[Summary] Pending product: ${newMetadata.pending_product ? 'Set' : 'None'}`);
    console.log(`[Summary] Processing time: ${Date.now() - startTime} ms`);
    console.log('[Summary] ===============================================\n');

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: finalResponse,
        state: newState,
        intent: decision.intent,
        confidence: decision.confidence
      }),
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
