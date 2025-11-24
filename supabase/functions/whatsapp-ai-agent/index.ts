import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { buildOrchestratorPrompt } from './orchestrator-prompt.ts';
import { buildConversationalAIPrompt } from './conversational-ai-prompt.ts';
import { detectOfferedProduct } from './product-detection.ts';
import { sendWhatsAppMessage } from '../_shared/evolutionClient.ts';
import { BASE_TOOLS, getBaseToolDefinition } from './base-tools.ts';
import { updateCustomerInsightsAfterOrder } from '../_shared/customerInsights.ts';
import { buildConversationContext } from './context-builder.ts';

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
    // STEP 1: LOAD AGENT CONFIGURATION FROM DATABASE
    // ============================================================
    
    console.log('[Agent Config] ========== LOADING AGENT CONFIGURATION ==========');
    
    // Load Orchestrator Agent
    const { data: orchestratorAgent } = await supabase
      .from('agents')
      .select('*')
      .eq('name', 'orchestrator')
      .eq('is_active', true)
      .maybeSingle();
    
    const useOrchestratorDB = !!orchestratorAgent;
    console.log(`[Agent Config] Orchestrator: ${useOrchestratorDB ? `✅ Loaded from DB (ID: ${orchestratorAgent.id}, Model: ${orchestratorAgent.model})` : '⚠️ Using fallback (hard-coded)'}`);
    
    // Load Conversational Agent
    const { data: conversationalAgent } = await supabase
      .from('agents')
      .select('*')
      .eq('name', 'conversational_ai')
      .eq('is_active', true)
      .maybeSingle();
    
    const useConversationalDB = !!conversationalAgent;
    console.log(`[Agent Config] Conversational: ${useConversationalDB ? `✅ Loaded from DB (ID: ${conversationalAgent.id}, Model: ${conversationalAgent.model})` : '⚠️ Using fallback (hard-coded)'}`);
    
    // Load Orchestrator Prompt Blocks
    let orchestratorPromptBlocks: any[] = [];
    if (orchestratorAgent) {
      const { data: blocks } = await supabase
        .from('agent_prompt_blocks')
        .select('*')
        .eq('agent_id', orchestratorAgent.id)
        .order('ordering');
      orchestratorPromptBlocks = blocks || [];
      console.log(`[Agent Config] Orchestrator prompt blocks: ${orchestratorPromptBlocks.length} blocks loaded`);
    }
    
    // Load Conversational Prompt Blocks
    let conversationalPromptBlocks: any[] = [];
    if (conversationalAgent) {
      const { data: blocks } = await supabase
        .from('agent_prompt_blocks')
        .select('*')
        .eq('agent_id', conversationalAgent.id)
        .order('ordering');
      conversationalPromptBlocks = blocks || [];
      console.log(`[Agent Config] Conversational prompt blocks: ${conversationalPromptBlocks.length} blocks loaded`);
    }
    
    // Load Enabled Tools for Conversational Agent
    let enabledToolsConfig: any[] = [];
    if (conversationalAgent) {
      const { data: tools } = await supabase
        .from('agent_tools')
        .select('*')
        .eq('agent_id', conversationalAgent.id)
        .eq('enabled', true)
        .order('ordering');
      enabledToolsConfig = tools || [];
      console.log(`[Agent Config] Enabled tools: ${enabledToolsConfig.length} tools configured`);
      if (enabledToolsConfig.length > 0) {
        console.log(`[Agent Config] Tool list: ${enabledToolsConfig.map(t => t.tool_name).join(', ')}`);
      }
    }
    
    console.log('[Agent Config] =============================================\n');

    // ============================================================
    // STEP 2: LOAD UNIFIED CONTEXT
    // ============================================================
    
    const context = await buildConversationContext(
      supabase,
      restaurantId,
      customerPhone,
      rawMessage
    );
    
    // Destructure for easier access
    let activeCart = context.activeCart; // Use 'let' because it gets reassigned
    const {
      restaurant,
      restaurantAISettings,
      promptOverrides,
      availableProducts,
      conversationHistory,
      cartItems,
      customer,
      pendingItems,
      conversationState,
      lastShownProducts,
      cartTotal,
      currentState,
      stateMetadata,
      pendingProduct,
      lastShownProduct,
      formatted
    } = context;

    // ============================================================
    // STEP 2: CALL ORDER ORCHESTRATOR
    // ============================================================
    
    console.log('[Orchestrator] ========== CALLING ORCHESTRATOR ==========');
    console.log('[Orchestrator] Context being passed:');
    console.log(`[Orchestrator]   - History: ${conversationHistory.length} messages (FULL)`);
    console.log(`[Orchestrator]   - State: ${currentState}`);
    console.log(`[Orchestrator]   - Pending: ${pendingProduct?.name || 'None'}`);
    console.log(`[Orchestrator]   - Cart: ${cartItems.length} items`);
    
    // Build orchestrator system prompt
    const orchestratorFallbackPrompt = buildOrchestratorPrompt({
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
    
    let orchestratorSystemPrompt = buildSystemPromptFromBlocks(
      orchestratorPromptBlocks,
      orchestratorFallbackPrompt
    );
    
    if (useOrchestratorDB && orchestratorPromptBlocks.length > 0) {
      // Apply template variables using unified formatted context
      orchestratorSystemPrompt = applyTemplateVariables(orchestratorSystemPrompt, {
        restaurant_name: restaurant.name,
        menu_products: formatted.menu,
        cart_summary: formatted.cart,
        customer_info: formatted.customer,
        conversation_history: formatted.history,
        current_state: currentState,
        pending_product: pendingProduct ? `${pendingProduct.name} (ID: ${pendingProduct.id})` : 'None',
        pending_items: formatted.pendingItems
      });
      
      // Apply orchestration config if present
      const orchestrationConfig = orchestratorAgent.orchestration_config as any;
      if (orchestrationConfig?.intents) {
        console.log('[Orchestrator] Applying orchestration rules from database config');
        orchestratorSystemPrompt += buildOrchestrationRulesSection(orchestrationConfig.intents);
      } else {
        console.log('[Orchestrator] No orchestration config found - using base prompt only');
      }
      
      console.log('[Orchestrator] ✅ Using database-configured prompt with template variables');
    } else {
      console.log('[Orchestrator] ⚠️ Using fallback hard-coded prompt');
    }
    
    console.log(`[Orchestrator] Prompt length: ${orchestratorSystemPrompt.length} characters`);
    console.log(`[Orchestrator] Prompt blocks used: ${orchestratorPromptBlocks.length}`);

    const orchestratorResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: orchestratorAgent?.model || 'gpt-4o',
        messages: [
          { role: 'system', content: orchestratorSystemPrompt },
          { role: 'user', content: "Analyze the context and return the intent JSON only." }
        ],
        max_tokens: orchestratorAgent?.max_tokens || 500,
        temperature: orchestratorAgent?.temperature ?? 1.0,
        ...(orchestratorAgent?.top_p !== null && orchestratorAgent?.top_p !== undefined && { top_p: orchestratorAgent.top_p }),
        ...(orchestratorAgent?.frequency_penalty !== null && orchestratorAgent?.frequency_penalty !== undefined && { frequency_penalty: orchestratorAgent.frequency_penalty }),
        ...(orchestratorAgent?.presence_penalty !== null && orchestratorAgent?.presence_penalty !== undefined && { presence_penalty: orchestratorAgent.presence_penalty }),
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
    
    // Build tools array dynamically from database or use fallback
    let tools: any[];
    
    if (useConversationalDB) {
      if (enabledToolsConfig.length > 0) {
        // Use database-configured tools
        tools = enabledToolsConfig.map(toolConfig => {
          const baseTool = getBaseToolDefinition(toolConfig.tool_name);
          
          if (!baseTool) {
            console.warn(`[Tools] ⚠️ Unknown tool: ${toolConfig.tool_name}, skipping`);
            return null;
          }
          
          return {
            type: "function",
            function: {
              ...baseTool.function,
              description: toolConfig.description_override || baseTool.function.description
            }
          };
        }).filter(Boolean);
        
        console.log(`[Tools] ✅ Using ${tools.length} database-configured tools: ${enabledToolsConfig.map(t => t.tool_name).join(', ')}`);
      } else {
        // No tools enabled in DB - agent will respond in natural language only
        tools = [];
        console.log(`[Tools] ⚠️ No tools enabled in database - agent will respond without tool calling`);
      }
    } else {
      // Fallback to hard-coded tools when no DB config exists
      tools = Object.values(BASE_TOOLS);
      console.log(`[Tools] ⚠️ Using ${tools.length} fallback hard-coded tools (no database config)`);
    }
    
    // Build conversational AI system prompt
    const conversationalFallbackPrompt = buildConversationalAIPrompt({
      restaurantName: restaurant.name,
      menuProducts: availableProducts,
      cartItems,
      cartTotal,
      currentState,
      userIntent: intent,
      targetState,
      conversationHistory,
      customer,
      pendingItems
    });
    
    let conversationalSystemPrompt = buildSystemPromptFromBlocks(
      conversationalPromptBlocks,
      conversationalFallbackPrompt
    );
    
    if (useConversationalDB && conversationalPromptBlocks.length > 0) {
      // Apply template variables using unified formatted context
      conversationalSystemPrompt = applyTemplateVariables(conversationalSystemPrompt, {
        restaurant_name: restaurant.name,
        menu_products: formatted.menu,
        cart_summary: formatted.cart,
        customer_info: formatted.customer,
        conversation_history: formatted.history,
        current_state: currentState,
        user_intent: intent,
        target_state: targetState,
        pending_items: formatted.pendingItems
      });
      
      // ============================================================
      // INJECT RESTAURANT-SPECIFIC AI SETTINGS
      // ============================================================
      
      if (restaurantAISettings) {
        console.log('[Main AI] Injecting restaurant-specific AI settings into prompt');
        
        const settingsSection = `

# RESTAURANT-SPECIFIC AI SETTINGS

You MUST adapt your behavior to these restaurant-specific settings:

**Tone**: ${restaurantAISettings.tone}
${restaurantAISettings.tone === 'friendly' ? '- Be warm, conversational, and use emojis occasionally' : ''}
${restaurantAISettings.tone === 'formal' ? '- Be polite, professional, and avoid slang or emojis' : ''}
${restaurantAISettings.tone === 'playful' ? '- Be fun, energetic, and use more emojis and casual language' : ''}
${restaurantAISettings.tone === 'professional' ? '- Be courteous, clear, and business-like without being cold' : ''}

**Greeting Message**: ${restaurantAISettings.greeting_message || 'Use default greeting based on tone'}

**Closing Message**: ${restaurantAISettings.closing_message || 'Use default closing based on tone'}

**Upsell Strategy**: ${restaurantAISettings.upsell_aggressiveness}
${restaurantAISettings.upsell_aggressiveness === 'low' ? '- Only suggest items if directly relevant to the customer\'s request' : ''}
${restaurantAISettings.upsell_aggressiveness === 'medium' ? '- Suggest complementary items when appropriate, but don\'t be pushy' : ''}
${restaurantAISettings.upsell_aggressiveness === 'high' ? '- Actively suggest add-ons, sides, drinks, and upgrades to increase order value' : ''}

**Max Additional Questions Before Checkout**: ${restaurantAISettings.max_additional_questions_before_checkout}
- After customer has items in cart and seems ready, ask at most ${restaurantAISettings.max_additional_questions_before_checkout} additional questions before offering to finalize the order.

**Language**: ${restaurantAISettings.language}

CRITICAL: These settings override your default behavior. Adapt your responses accordingly.
`;
        
        conversationalSystemPrompt += settingsSection;
      }
      
      // Apply prompt overrides if any
      if (promptOverrides && promptOverrides.length > 0) {
        console.log('[Main AI] Applying restaurant-specific prompt overrides');
        promptOverrides.forEach((override: any) => {
          console.log(`[Main AI]   - Overriding block: ${override.block_key}`);
          // Add override section to prompt
          conversationalSystemPrompt += `\n\n# RESTAURANT OVERRIDE: ${override.block_key}\n\n${override.content}\n`;
        });
      }
      
      // Add tool usage rules section
      if (enabledToolsConfig.length > 0) {
        console.log('[Main AI] Applying tool usage rules from database config');
        conversationalSystemPrompt += buildToolUsageRulesSection(enabledToolsConfig);
      }
      
      // Apply behavior config if present
      const behaviorConfig = conversationalAgent.behavior_config as any;
      if (behaviorConfig && (behaviorConfig.customer_profile || behaviorConfig.pending_products)) {
        console.log('[Main AI] Applying behavior config from database (customer profile & pending products)');
        conversationalSystemPrompt += buildBehaviorConfigSection(behaviorConfig);
      } else {
        console.log('[Main AI] No behavior config found - using base prompt only');
      }
      
      console.log('[Main AI] ✅ Using database-configured prompt with template variables');
    } else {
      console.log('[Main AI] ⚠️ Using fallback hard-coded prompt');
    }
    
    console.log(`[Main AI] Prompt length: ${conversationalSystemPrompt.length} characters`);
    console.log(`[Main AI] Prompt blocks used: ${conversationalPromptBlocks.length}`);

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: conversationalAgent?.model || 'gpt-4o',
        messages: [
          { role: 'system', content: conversationalSystemPrompt },
          ...conversationHistory,
          { role: 'user', content: rawMessage }
        ],
        ...(tools.length > 0 && { tools }),
        max_tokens: conversationalAgent?.max_tokens || 500,
        temperature: conversationalAgent?.temperature ?? 1.0,
        ...(conversationalAgent?.top_p !== null && conversationalAgent?.top_p !== undefined && { top_p: conversationalAgent.top_p }),
        ...(conversationalAgent?.frequency_penalty !== null && conversationalAgent?.frequency_penalty !== undefined && { frequency_penalty: conversationalAgent.frequency_penalty }),
        ...(conversationalAgent?.presence_penalty !== null && conversationalAgent?.presence_penalty !== undefined && { presence_penalty: conversationalAgent.presence_penalty })
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

        // 2) orchestrator intent clearly related to products (RELAXED)
        const isProductIntent =
          intent === 'browse_product' ||
          intent === 'confirm_item' ||
          intent === 'collect_customer_data' || // Can include products during data collection
          (confidence >= 0.8 && !!pendingProduct); // High confidence + product detected

        // 3) Semantic analysis for explicit requests
        const userLower = userMessage.toLowerCase();
        const semanticMatch = 
          userLower.includes('quero') || 
          userLower.includes('adiciona') ||
          userLower.includes('manda') ||
          userLower.includes('também') ||
          userLower.includes('mais') ||
          userLower.includes('coloca');

        const isExplicitRequest = 
          mentionsProductByName || 
          isProductIntent ||
          (semanticMatch && !!pendingProduct && confidence >= 0.7); // Semantic signals + product + reasonable confidence

        if (!isExplicitRequest) {
          console.log(
            `[Tool Validation] ❌ Skipping add_to_cart: no explicit product request (intent=${intent}, confidence=${confidence}, semantic=${semanticMatch})`,
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
    
    // Fallback if ALL tool calls were rejected
    if (toolCalls.length > 0 && validatedToolCalls.length === 0) {
      console.error('[Tool Validation] ❌ ALL tools rejected. Generating fallback response...');
      
      const fallbackResponse = `Desculpa, não consegui processar o teu pedido corretamente. 😅 Podes tentar de novo mencionando o produto que queres? Por exemplo: "Quero uma Pizza Margherita".`;
      
      await supabase.from('messages').insert({
        restaurant_id: restaurantId,
        from_number: restaurant.phone,
        to_number: customerPhone,
        body: fallbackResponse,
        direction: 'outbound',
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: fallbackResponse,
          warning: 'Tool validation failed, fallback response generated'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ============================================================
    // STEP 4: EXECUTE VALIDATED TOOL CALLS
    // ============================================================
    
    console.log('\n[Tool Execution] ========== EXECUTING TOOL CALLS ==========');
    
    let newState = targetState;
    let newMetadata = { ...stateMetadata };
    const toolResults: any[] = [];
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
            
            // Update customer insights
            try {
              await updateCustomerInsightsAfterOrder(supabase as any, {
                phone: customerPhone,
                orderId: order.id,
                total: orderTotal,
                items: cartItems.map((item: any) => ({
                  productId: item.product_id,
                  productName: item.product_name,
                  addons: (item.addons || []).map((a: any) => ({
                    addonId: a.id,
                    addonName: a.name
                  }))
                })),
                status: 'confirmed'
              });
              console.log('[Tool] ✅ Customer insights updated');
            } catch (insightError) {
              console.error('[Tool] ⚠️ Customer insights update failed:', insightError);
            }
            
            // Clear metadata and nullify cart for clean slate
            newMetadata = {};
            newState = 'idle';
            activeCart = null;
            cartModified = true;
            finalizeSuccess = true;
          }
          break;
        }
        
        case 'update_customer_profile': {
          const { name, default_address, default_payment_method } = args;
          
          const updateData: any = { phone: customerPhone };
          if (name !== undefined) updateData.name = name;
          if (default_address !== undefined) updateData.default_address = default_address;
          if (default_payment_method !== undefined) updateData.default_payment_method = default_payment_method;
          
          const { error: profileError } = await supabase
            .from('customers')
            .upsert(updateData, { onConflict: 'phone' });
          
          if (profileError) {
            console.error('[Tool] Update customer profile error:', profileError);
          } else {
            console.log('[Tool] ✅ Updated customer profile');
          }
          break;
        }
        
        case 'show_cart': {
          // AI uses this to display cart contents - no action needed
          console.log('[Tool] ✅ Showing cart');
          break;
        }
        
        case 'clear_cart': {
          if (activeCart) {
            await supabase
              .from('cart_items')
              .delete()
              .eq('cart_id', activeCart.id);
            
            cartModified = true;
            console.log('[Tool] ✅ Cleared cart');
          }
          break;
        }
        
        case 'search_menu': {
          const { query, category, max_results = 5 } = args;
          console.log(`[Tool] 🔍 Searching menu for "${query}" (category: ${category || 'all'}, max: ${max_results})`);
          
          // Perform intelligent search with fuzzy matching
          const results = searchProducts(availableProducts, query, category, max_results);
          
          // Save results for positional selection (e.g., "a segunda", "número 3")
          if (results.length > 0) {
            await supabase
              .from('conversation_state')
              .update({ 
                last_shown_products: results.map(r => ({
                  id: r.product.id,
                  name: r.product.name
                }))
              })
              .eq('user_phone', customerPhone)
              .eq('restaurant_id', restaurantId);
            
            console.log(`[Tool] 💾 Saved ${results.length} products to last_shown_products`);
          }
          
          console.log(`[Tool] ✅ Found ${results.length} results for "${query}"`);
          
          toolResults.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify({
              found: results.length > 0,
              count: results.length,
              products: results.map(r => ({
                id: r.product.id,
                name: r.product.name,
                price: r.product.price,
                category: r.product.category,
                description: r.product.description,
                similarity: r.similarity
              }))
            })
          });
          break;
        }
        
        case 'add_pending_item': {
          const { product_id, quantity = 1, addon_ids = [], notes } = args;
          
          const product = availableProducts.find(p => p.id === product_id);
          if (!product) {
            console.error(`[Tool] Product not found: ${product_id}`);
            continue;
          }
          
          const { data: pendingItem, error: pendingError } = await supabase
            .from('conversation_pending_items')
            .insert({
              user_phone: customerPhone,
              restaurant_id: restaurantId,
              product_id,
              quantity,
              addon_ids,
              notes,
              status: 'pending'
            })
            .select()
            .single();
          
          if (pendingError) {
            console.error('[Tool] Add pending item error:', pendingError);
          } else {
            console.log(`[Tool] ✅ Added ${quantity}x ${product.name} to pending items`);
          }
          break;
        }
        
        case 'confirm_pending_items': {
          console.log('[Tool] ⚡ Confirming all pending items...');
          
          // Load all pending items
          const { data: itemsToConfirm } = await supabase
            .from('conversation_pending_items')
            .select('*')
            .eq('user_phone', customerPhone)
            .eq('restaurant_id', restaurantId)
            .eq('status', 'pending');
          
          if (!itemsToConfirm || itemsToConfirm.length === 0) {
            console.log('[Tool] ⚠️ No pending items to confirm');
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
          
          // Move each pending item to cart
          for (const pendingItem of itemsToConfirm) {
            // Check if product already in cart
            const existingCartItem = cartItems.find(
              (ci: any) => ci.product_id === pendingItem.product_id
            );
            
            if (existingCartItem) {
              // Update quantity
              await supabase
                .from('cart_items')
                .update({ 
                  quantity: existingCartItem.quantity + pendingItem.quantity 
                })
                .eq('cart_id', activeCart!.id)
                .eq('product_id', pendingItem.product_id);
              
              console.log(`[Tool] ✅ Updated quantity for existing item`);
            } else {
              // Add new item
              const { data: cartItem } = await supabase
                .from('cart_items')
                .insert({
                  cart_id: activeCart!.id,
                  product_id: pendingItem.product_id,
                  quantity: pendingItem.quantity,
                  notes: pendingItem.notes
                })
                .select()
                .single();
              
              // Add addons if specified
              if (cartItem && pendingItem.addon_ids && pendingItem.addon_ids.length > 0) {
                const addonInserts = pendingItem.addon_ids.map((addon_id: string) => ({
                  cart_item_id: cartItem.id,
                  addon_id
                }));
                
                await supabase
                  .from('cart_item_addons')
                  .insert(addonInserts);
              }
              
              console.log(`[Tool] ✅ Added pending item to cart`);
            }
          }
          
          // Mark all pending items as confirmed
          await supabase
            .from('conversation_pending_items')
            .update({ status: 'confirmed' })
            .eq('user_phone', customerPhone)
            .eq('restaurant_id', restaurantId)
            .eq('status', 'pending');
          
          cartModified = true;
          console.log(`[Tool] ✅ Confirmed ${itemsToConfirm.length} pending items to cart`);
          break;
        }
        
        case 'clear_pending_items': {
          await supabase
            .from('conversation_pending_items')
            .update({ status: 'discarded' })
            .eq('user_phone', customerPhone)
            .eq('restaurant_id', restaurantId)
            .eq('status', 'pending');
          
          console.log('[Tool] ✅ Cleared all pending items');
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
    
    // Get restaurant's WhatsApp instance
    const { data: whatsappInstance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, status')
      .eq('restaurant_id', restaurantId)
      .single();

    const instanceName = whatsappInstance?.instance_name || Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'default';
    
    // Send WhatsApp response (non-blocking for test environments)
    try {
      await sendWhatsAppMessage(instanceName, customerPhone, finalResponse);
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

// ============================================================
// HELPER FUNCTIONS FOR TEMPLATE VARIABLES AND FORMATTING
// ============================================================

/**
 * Build system prompt from agent_prompt_blocks or use fallback
 */
function buildSystemPromptFromBlocks(
  blocks: any[] | null | undefined,
  fallback: string
): string {
  if (!blocks || blocks.length === 0) {
    return fallback;
  }
  
  return blocks.map(block => block.content).join('\n\n');
}

/**
 * Intelligent product search with fuzzy matching
 */
function searchProducts(
  products: any[], 
  query: string, 
  category?: string, 
  maxResults: number = 5
): Array<{ product: any; similarity: number }> {
  const queryLower = query.toLowerCase().trim();
  
  // Filter by category if specified
  let filtered = category
    ? products.filter(p => p.category.toLowerCase().includes(category.toLowerCase()))
    : products;
  
  // Calculate similarity for each product
  const scored = filtered.map(product => {
    let score = 0;
    const nameLower = product.name.toLowerCase();
    const descLower = (product.description || '').toLowerCase();
    
    // 1. Exact match (maximum score)
    if (nameLower === queryLower) {
      score = 1.0;
    }
    // 2. Contains full query
    else if (nameLower.includes(queryLower)) {
      score = 0.8;
    }
    else if (descLower.includes(queryLower)) {
      score = 0.6;
    }
    // 3. Fuzzy matching (Levenshtein distance)
    else {
      const distance = levenshteinDistance(queryLower, nameLower);
      const maxLen = Math.max(queryLower.length, nameLower.length);
      score = 1 - (distance / maxLen);
    }
    
    // 4. Word-based matching for multi-word queries
    const queryWords = queryLower.split(/\s+/);
    const nameWords = nameLower.split(/\s+/);
    const matchingWords = queryWords.filter((qw: string) => 
      nameWords.some((nw: string) => nw.includes(qw) || qw.includes(nw))
    ).length;
    
    if (matchingWords > 0 && score < 0.5) {
      score = Math.max(score, 0.3 + (matchingWords / queryWords.length) * 0.4);
    }
    
    return { product, similarity: score };
  });
  
  // Sort by score and return top N (with minimum threshold)
  return scored
    .filter(s => s.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}

/**
 * Levenshtein distance for fuzzy string matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => 
    Array(a.length + 1).fill(null)
  );
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,      // insertion
        matrix[j - 1][i] + 1,      // deletion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Apply template variables to a prompt string
 */
function applyTemplateVariables(prompt: string, variables: Record<string, string>): string {
  let result = prompt;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replaceAll(placeholder, value);
  }
  
  return result;
}

/**
 * Build orchestration rules section from config
 */
function buildOrchestrationRulesSection(intents: Record<string, any>): string {
  let section = '\n\n# ORCHESTRATION RULES (FROM DATABASE CONFIG)\n\n';
  section += 'These rules guide intent classification and state transitions:\n\n';
  
  for (const [intentName, intentConfig] of Object.entries(intents)) {
    section += `## Intent: ${intentName}\n`;
    
    if (intentConfig.decision_hint) {
      section += `**When to use**: ${intentConfig.decision_hint}\n`;
    }
    
    if (intentConfig.allowed_tools && intentConfig.allowed_tools.length > 0) {
      section += `**Allowed tools**: ${intentConfig.allowed_tools.join(', ')}\n`;
    }
    
    section += '\n';
  }
  
  console.log(`[Orchestration Rules] Injected ${Object.keys(intents).length} intent rules into prompt`);
  return section;
}

/**
 * Build tool usage rules section from enabled tools config
 */
function buildToolUsageRulesSection(enabledTools: any[]): string {
  const toolsWithRules = enabledTools.filter(t => t.usage_rules);
  
  if (toolsWithRules.length === 0) return '';
  
  let section = '\n\n# TOOL USAGE RULES (FROM DATABASE CONFIG)\n\n';
  section += 'Follow these specific rules when using tools:\n\n';
  
  for (const tool of toolsWithRules) {
    section += `## Tool: ${tool.tool_name}\n`;
    section += `${tool.usage_rules}\n\n`;
  }
  
  console.log(`[Tool Usage Rules] Injected usage rules for ${toolsWithRules.length} tools into prompt`);
  return section;
}

/**
 * Build behavior config section
 */
function buildBehaviorConfigSection(behaviorConfig: any): string {
  let section = '\n\n# BEHAVIOR CONFIGURATION (FROM DATABASE)\n\n';
  let configCount = 0;
  
  if (behaviorConfig.customer_profile) {
    const cp = behaviorConfig.customer_profile;
    section += '## Customer Profile Behavior\n\n';
    section += 'Guidelines for managing customer profile data:\n\n';
    section += `- **Auto-load profile**: ${cp.auto_load ? 'YES - Load customer data at conversation start' : 'NO - Only load when explicitly needed'}\n`;
    section += `- **Update name from conversation**: ${cp.update_name_from_conversation ? 'YES - Extract and save customer name when mentioned' : 'NO - Do not update name automatically'}\n`;
    section += `- **Update address on confirmation**: ${cp.update_address_on_confirmation ? 'YES - Save address when order is confirmed' : 'NO - Do not save address automatically'}\n`;
    section += `- **Update payment on confirmation**: ${cp.update_payment_on_confirmation ? 'YES - Save payment method when order is confirmed' : 'NO - Do not save payment automatically'}\n\n`;
    
    if (cp.update_name_from_conversation || cp.update_address_on_confirmation || cp.update_payment_on_confirmation) {
      section += `Use the \`update_customer_profile\` tool when these conditions are met.\n\n`;
    }
    configCount++;
  }
  
  if (behaviorConfig.pending_products) {
    const pp = behaviorConfig.pending_products;
    section += '## Pending Products Behavior\n\n';
    section += 'Guidelines for handling product selection before adding to cart:\n\n';
    section += `- **Multiple pending items**: ${pp.allow_multiple ? 'YES - Customer can have multiple products pending confirmation' : 'NO - Only one product can be pending at a time'}\n`;
    section += `- **Expiration time**: Pending items expire after ${pp.expiration_minutes || 15} minutes\n\n`;
    section += 'Expected flow:\n';
    section += '1. Use `add_pending_item` when customer shows interest but hasn\'t confirmed\n';
    section += '2. Use `confirm_pending_items` after explicit customer confirmation\n';
    section += '3. Use `clear_pending_items` if customer wants to start over\n\n';
    configCount++;
  }
  
  if (configCount > 0) {
    console.log(`[Behavior Config] Injected ${configCount} behavior sections into prompt`);
  }
  
  return section;
}
