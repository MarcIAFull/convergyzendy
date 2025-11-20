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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
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

    const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = (messageHistory || []).reverse().map(msg => ({
      role: (msg.direction === 'incoming' ? 'user' : 'assistant') as 'user' | 'assistant',
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
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: orchestratorPrompt },
          { role: 'user', content: "Analyze the context and return the intent JSON only." }
        ],
        max_tokens: 500,
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
          description: "Add a product to the customer's cart with optional addons",
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
              addon_ids: {
                type: "array",
                items: { type: "string" },
                description: "Array of addon UUIDs to include with this product (e.g., ['addon-uuid-1', 'addon-uuid-2']). Only use addons that belong to this specific product."
              },
              notes: {
                type: "string",
                description: "Optional special instructions or customizations that are NOT available as addons"
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
      targetState,
      conversationHistory // ✅ pass full history here
    });

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: conversationalPrompt },
          ...conversationHistory,
          { role: 'user', content: rawMessage }
        ],
        tools,
        max_tokens: 500
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
    // STEP 4: VALIDATE AND EXECUTE TOOL CALLS
    // ============================================================
    
    console.log('\n[Tool Validation] ========== VALIDATING TOOL CALLS ==========');
    console.log('[Tool Validation] Raw tool calls:', JSON.stringify(toolCalls, null, 2));
    
    const validatedToolCalls: typeof toolCalls = [];
    const userMessage = rawMessage.toLowerCase().trim();
    
    for (const toolCall of toolCalls) {
      const fn = toolCall.function?.name;
      const args = toolCall.function?.arguments
        ? JSON.parse(toolCall.function.arguments)
        : {};

      if (fn === 'add_to_cart') {
        const product = availableProducts.find((p) => p.id === args.product_id);
        const productName = product?.name?.toLowerCase() || '';

        // CRITICAL VALIDATION: If intent is "confirm_item" with pending product, 
        // the product_id MUST match the pending product
        if (intent === 'confirm_item' && pendingProduct) {
          if (args.product_id !== pendingProduct.id) {
            console.log(
              `[Tool Validation] ❌ Skipping add_to_cart: User is confirming "${pendingProduct.name}" but AI tried to add "${product?.name || 'unknown'}" (product_id mismatch)`
            );
            console.log(`[Tool Validation] Expected product_id: ${pendingProduct.id}, Got: ${args.product_id}`);
            continue; // ❌ Reject this tool call
          }
        }

        // 1) explicit request for a product, by name, in the current user message
        const mentionsProductByName =
          !!productName && userMessage.includes(productName);

        // 2) orchestrator intent clearly related to products
        const isProductIntent =
          intent === 'browse_product' ||
          (intent === 'confirm_item' && !!pendingProduct);

        const isExplicitRequest = mentionsProductByName || isProductIntent;

        if (!isExplicitRequest) {
          console.log(
            '[Tool Validation] ❌ Skipping add_to_cart: no explicit product request or valid confirmation (we rely on orchestrator intent + product context, not static keywords).',
          );
          continue; // ❌ do not execute this add_to_cart
        }

        // ============================================================
        // AUTO-CORRECTION: Detect mentioned addons and add them if missing
        // ============================================================
        const availableAddons = product?.addons || [];
        const mentionedAddons = availableAddons.filter((addon: any) =>
          userMessage.includes(addon.name.toLowerCase())
        );
        
        if (mentionedAddons.length > 0 && (!args.addon_ids || args.addon_ids.length === 0)) {
          console.warn(
            `[Tool Validation] ⚠️ User mentioned addon(s) "${mentionedAddons.map((a: any) => a.name).join(', ')}" but AI didn't include addon_ids. Auto-correcting...`
          );
          
          // Auto-correct by adding addon_ids
          args.addon_ids = mentionedAddons.map((a: any) => a.id);
          
          // Update the tool call arguments
          toolCall.function.arguments = JSON.stringify(args);
          
          console.log(`[Tool Validation] ✅ Auto-corrected addon_ids: ${args.addon_ids.join(', ')}`);
        }

        console.log(
          `[Tool Validation] ✅ add_to_cart validated: ${product?.name} (${args.product_id})`,
        );
        validatedToolCalls.push(toolCall);
        continue;
      }

      // For all other tools (set_delivery_address, set_payment_method, finalize_order, etc.)
      // keep current behavior, just passing them through:
      validatedToolCalls.push(toolCall);
    }
    
    console.log(`[Tool Validation] Validated tool calls: ${validatedToolCalls.length} of ${toolCalls.length}`);
    
    // CRITICAL CHECK: If AI tried to call tools but ALL were rejected by validation
    if (toolCalls.length > 0 && validatedToolCalls.length === 0) {
      console.error('[Tool Validation] ❌ CRITICAL: AI called tools but ALL were rejected by validation');
      console.error('[Tool Validation] Common causes:');
      console.error('  - Product ID mismatch in confirm_item intent');
      console.error('  - Invalid product request without explicit user mention');
      console.error('  - Tool validation rules blocked all attempted actions');
      console.error('[Tool Validation] → Aborting execution to prevent misleading success messages');
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Tool validation failed',
          details: 'AI attempted tool calls but they were rejected by validation rules. No actions were taken.',
          attempted_tools: toolCalls.length,
          validated_tools: 0
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('\n[Tool Execution] ========== EXECUTING TOOL CALLS ==========');
    
    let newState = targetState;
    let newMetadata = { ...stateMetadata };
    let finalizeSuccess = false; // Track if finalize_order succeeded
    let cartModified = false; // Track if we need to re-fetch cart data
    
    for (const toolCall of validatedToolCalls) {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      
      console.log(`[Tool] ──────────────────────────────────────────────`);
      console.log(`[Tool] Executing: ${functionName}`);
      console.log(`[Tool] Arguments:`, JSON.stringify(args, null, 2));
      
      switch (functionName) {
        case 'add_to_cart': {
          const { product_id, quantity = 1, addon_ids = [], notes } = args;
          
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
          const { data: cartItem, error: addError } = await supabase
            .from('cart_items')
            .insert({
              cart_id: activeCart!.id,
              product_id,
              quantity,
              notes
            })
            .select()
            .single();
          
          if (addError) {
            console.error('[Tool] Add to cart error:', addError);
          } else {
            console.log(`[Tool] ✅ Added ${quantity}x ${product.name}${notes ? ` (${notes})` : ''} to cart`);
            
            // Add addons if specified
            if (addon_ids && addon_ids.length > 0) {
              const addonInserts = addon_ids.map((addon_id: string) => ({
                cart_item_id: cartItem.id,
                addon_id
              }));
              
              const { error: addonError } = await supabase
                .from('cart_item_addons')
                .insert(addonInserts);
              
              if (addonError) {
                console.error('[Tool] Error adding addons:', addonError);
              } else {
                const addedAddons = (product.addons || [])
                  .filter((a: any) => addon_ids.includes(a.id))
                  .map((a: any) => a.name);
                console.log(`[Tool] ✅ Added addons: ${addedAddons.join(', ')}`);
              }
            }
            
            newState = 'confirming_item';
            cartModified = true; // Mark that cart needs re-fetch
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
            cartModified = true; // Mark that cart needs re-fetch
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
            // Don't set finalizeSuccess, leave it false
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
            
            // Mark cart as completed
            await supabase
              .from('carts')
              .update({ status: 'completed' })
              .eq('id', activeCart.id);
            
            // Clear metadata and nullify cart for clean slate
            newMetadata = {};
            newState = 'idle';
            activeCart = null; // CRITICAL: Clear cart reference so next message starts fresh
            cartModified = true; // Force re-fetch (will be null)
            finalizeSuccess = true; // Mark as successful
          }
          break;
        }
      }
    }
    
    // ============================================================
    // RE-FETCH CART DATA AFTER MODIFICATIONS
    // ============================================================
    
    if (cartModified) {
      console.log('[Cart Refresh] ========== RE-FETCHING CART DATA ==========');
      
      if (activeCart) {
        // Re-fetch cart items with updated data
        const { data: refreshedCart } = await supabase
          .from('carts')
          .select(`
            *,
            cart_items (
              id,
              product_id,
              quantity,
              notes,
              products (id, name, price)
            )
          `)
          .eq('id', activeCart.id)
          .single();
        
        if (refreshedCart) {
          const cartId = refreshedCart.id;
          activeCart = refreshedCart;
          
          // Re-fetch cart items with addons
          const { data: itemsWithAddons } = await supabase
            .from('cart_items')
            .select(`
              *,
              products (id, name, price),
              cart_item_addons (
                id,
                addons (id, name, price)
              )
            `)
            .eq('cart_id', cartId);
          
          // Update cartItems with fresh data including addons
          const refreshedItems = (itemsWithAddons || []).map((item: any) => {
            const addonsTotal = (item.cart_item_addons || []).reduce(
              (sum: number, cia: any) => sum + (cia.addons?.price || 0), 
              0
            );
            return {
              product_id: item.product_id,
              product_name: item.products.name,
              quantity: item.quantity,
              price: item.products.price,
              total_price: item.quantity * (item.products.price + addonsTotal),
              notes: item.notes,
              addons: item.cart_item_addons?.map((cia: any) => cia.addons) || []
            };
          });
          
          // Replace old cartItems with fresh data
          cartItems.length = 0;
          cartItems.push(...refreshedItems);
          
          const newCartTotal = cartItems.reduce((sum: number, item: any) => sum + item.total_price, 0);
          console.log(`[Cart Refresh] ✅ Cart refreshed: ${cartItems.length} items, Total: €${newCartTotal.toFixed(2)}`);
        }
      } else {
        // Cart was nullified (e.g., after finalize)
        cartItems.length = 0;
        console.log('[Cart Refresh] ✅ Cart cleared (no active cart)');
      }
    }
    
    console.log(`\n[Response] ========== RESPONSE CONSTRUCTION ==========`);
    console.log(`[Response] Tool calls validated and executed: ${validatedToolCalls.length}`);
    console.log(`[Response] AI-generated message: "${finalResponse || '(empty)'}"`);
    
    // Fallback: If AI didn't provide a message after tool execution, construct one
    if ((!finalResponse || finalResponse.trim() === '') && validatedToolCalls.length > 0) {
      console.log('[Response] ⚠️ AI returned empty response, constructing fallback...');
      
      const confirmations: string[] = [];
      
      for (const toolCall of validatedToolCalls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        switch (functionName) {
          case 'add_to_cart': {
            const product = availableProducts.find(p => p.id === args.product_id);
            if (product) {
              const qty = args.quantity || 1;
              const addonNames = (args.addon_ids || [])
                .map((id: string) => product.addons?.find((a: any) => a.id === id)?.name)
                .filter(Boolean);
              const addonText = addonNames.length > 0 ? ` com ${addonNames.join(', ')}` : '';
              const notesText = args.notes ? ` (${args.notes})` : '';
              confirmations.push(`✅ Adicionei ${qty}x ${product.name}${addonText}${notesText} ao teu carrinho!`);
            }
            break;
          }
          
          case 'remove_from_cart': {
            const product = availableProducts.find(p => p.id === args.product_id);
            if (product) {
              confirmations.push(`❌ Removi ${product.name} do carrinho.`);
            }
            break;
          }
          
          case 'set_delivery_address': {
            confirmations.push(`📍 Endereço guardado: ${args.address}`);
            break;
          }
          
          case 'set_payment_method': {
            const methodNames: { [key: string]: string } = {
              cash: 'Dinheiro',
              card: 'Cartão',
              mbway: 'MBWay'
            };
            confirmations.push(`💳 Pagamento: ${methodNames[args.method] || args.method}`);
            break;
          }
          
          case 'finalize_order': {
            if (finalizeSuccess) {
              // Use fresh cart data (re-fetched after tool execution)
              const finalTotal = cartItems.reduce((sum, item) => sum + item.total_price, 0);
              confirmations.push(`🎉 Pedido confirmado! Total: €${finalTotal.toFixed(2)}`);
              confirmations.push(`O teu pedido chegará em breve!`);
            } else {
              // Finalize failed - ask for missing info
              if (!newMetadata.delivery_address && !newMetadata.payment_method) {
                confirmations.push('Para finalizar, preciso do teu endereço de entrega e método de pagamento.');
              } else if (!newMetadata.delivery_address) {
                confirmations.push('Para finalizar, preciso do teu endereço de entrega.');
              } else if (!newMetadata.payment_method) {
                confirmations.push('Para finalizar, preciso do método de pagamento (dinheiro, cartão ou MBWay).');
              }
            }
            break;
          }
          
          default:
            confirmations.push(`✅ Ação executada: ${functionName}`);
        }
      }
      
      finalResponse = confirmations.join(' ');
      console.log(`[Response] Fallback message constructed: "${finalResponse}"`);
    }
    
    // CRITICAL CHECK: If we still have no response, something went wrong
    if (!finalResponse || finalResponse.trim() === '') {
      console.error('[Response] ❌ CRITICAL: No response generated and no valid tools executed');
      console.error('[Response] This should not happen - AI must either:');
      console.error('  1. Generate a conversational message, OR');
      console.error('  2. Execute validated tools with fallback confirmations');
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No response generated',
          details: 'AI did not generate a message and no tools produced output',
          state: currentState,
          intent: decision?.intent
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log(`[Response] Final message to send: "${finalResponse}"`);
    console.log(`[Response] Message length: ${finalResponse.length} characters`);
    
    // ============================================================
    // SECOND MESSAGE: Conversational follow-up after tool execution
    // ============================================================
    
    let secondMessage = '';
    
    if (validatedToolCalls.length > 0) {
      console.log('\n[Second Message] ========== GENERATING CONVERSATIONAL FOLLOW-UP ==========');
      
      // Build context for second message with UPDATED cart state
      const updatedCartSummary = cartItems.length > 0
        ? cartItems.map((item: any) => {
            const addonText = item.addons && item.addons.length > 0
              ? ` com ${item.addons.map((a: any) => a.name).join(', ')}`
              : '';
            return `${item.quantity}x ${item.product_name}${addonText} (€${item.total_price.toFixed(2)})`;
          }).join(', ')
        : 'Carrinho vazio';
      
      const updatedCartTotal = cartItems.reduce((sum: number, item: any) => sum + item.total_price, 0);
      
      const secondMessagePrompt = `Tu és o assistente de pedidos do ${restaurant.name}.

As tools foram executadas com sucesso. Agora preciso que escrevas uma mensagem natural e amigável em Português para o cliente.

**Estado atual do carrinho (ATUALIZADO):**
${updatedCartSummary}
**Total: €${updatedCartTotal.toFixed(2)}**

**Estado atual:** ${newState}
**Endereço de entrega:** ${newMetadata.delivery_address || 'Não definido'}
**Método de pagamento:** ${newMetadata.payment_method || 'Não definido'}

**Tools que foram executadas:**
${validatedToolCalls.map((tc: any) => {
  const fn = tc.function.name;
  const args = JSON.parse(tc.function.arguments);
  return `- ${fn}: ${JSON.stringify(args)}`;
}).join('\n')}

**Instruções:**
1. Confirma as ações executadas de forma natural e conversacional
2. Mostra o estado atual do carrinho se relevante
3. Sugere o próximo passo lógico no fluxo de pedido
4. Mantém a mensagem curta (2-3 frases)
5. Usa emojis apropriados 
6. Se o pedido foi finalizado, congratula o cliente e dá detalhes do pedido

**IMPORTANTE:** NÃO chames tools novamente. Apenas escreve uma mensagem conversacional.`;

      try {
        const secondAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: secondMessagePrompt },
              { role: 'user', content: 'Gera a mensagem conversacional agora.' }
            ],
            max_tokens: 300
          }),
        });

        if (secondAiResponse.ok) {
          const secondAiData = await secondAiResponse.json();
          secondMessage = secondAiData.choices[0].message.content || '';
          
          if (secondMessage && secondMessage.trim() !== '') {
            console.log(`[Second Message] ✅ Generated: "${secondMessage}"`);
            // Replace the first message with the second one (more contextual)
            finalResponse = secondMessage;
          } else {
            console.log('[Second Message] ⚠️ Empty second message, keeping first message');
          }
        } else {
          console.error('[Second Message] ❌ Failed to generate second message');
        }
      } catch (secondMsgError) {
        console.error('[Second Message] ❌ Error generating second message:', secondMsgError);
        // Keep first message as fallback
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

    // ============================================================
    // SAVE AI RESPONSE TO DATABASE
    // ============================================================
    // Note: User's message is already saved by webhook
    // Here we only save the AI's outbound response
    
    console.log('\n[Messages] ========== SAVING AI RESPONSE ==========');
    
    // Validate message before saving
    if (!finalResponse || finalResponse.trim().length === 0) {
      console.error('[Messages] ❌ Cannot save empty AI response');
      throw new Error('Empty response - cannot save to database');
    }

    // Save ONLY the AI response (webhook already saved user message)
    try {
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          restaurant_id: restaurantId,
          from_number: restaurant.phone,
          to_number: customerPhone,
          body: finalResponse,
          direction: 'outbound'
        });

      if (messageError) {
        console.error('[Messages] ❌ Failed to save AI response:', messageError);
        throw messageError;
      }
      
      console.log('[Messages] ✅ AI response saved to database');
    } catch (saveError) {
      console.error('[Messages] ❌ Exception saving AI response:', saveError);
      // Don't throw - processing succeeded, just log the error
    }

    console.log('\n[WhatsApp] ========== SENDING RESPONSE ==========');
    
    // Validate message before sending
    if (!finalResponse || finalResponse.trim().length === 0) {
      console.error('[WhatsApp] ❌ Cannot send empty message to WhatsApp');
      throw new Error('Empty response after tool execution - this should never happen');
    }
    
    console.log(`[WhatsApp] Message to send: "${finalResponse.substring(0, 150)}${finalResponse.length > 150 ? '...' : ''}"`);
    console.log(`[WhatsApp] Message length: ${finalResponse.length} characters`);
    
    // Send WhatsApp response (non-blocking for test environments)
    try {
      await sendWhatsAppMessage(customerPhone, finalResponse);
      console.log(`[WhatsApp] ✅ WhatsApp message sent successfully`);
    } catch (whatsappError: any) {
      console.warn(`[WhatsApp] ⚠️ Failed to send WhatsApp (test mode?):`, whatsappError.message);
      // Continue anyway - AI processing succeeded
    }

    // ============================================================
    // METRICS LOGGING
    // ============================================================
    
    const metrics = {
      orchestrator_intent: intent,
      target_state: targetState,
      tools_called_raw: toolCalls.length,
      tools_executed: validatedToolCalls.length,
      ai_response_empty: !finalResponse || finalResponse.trim() === '',
      processing_time_ms: Date.now() - startTime,
      state_transition: `${currentState} → ${newState}`
    };

    console.log('[Metrics]', JSON.stringify(metrics));
    
    console.log('\n[Summary] ========== PROCESSING COMPLETE ==========');
    console.log(`[Summary] Intent classified: ${intent} (confidence: ${confidence})`);
    console.log(`[Summary] Tools called (raw): ${toolCalls.length}`);
    console.log(`[Summary] Tools executed (validated): ${validatedToolCalls.length}`);
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
