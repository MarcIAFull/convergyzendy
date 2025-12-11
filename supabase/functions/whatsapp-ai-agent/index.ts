import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { buildOrchestratorPrompt } from './orchestrator-prompt.ts';
import { buildConversationalAIPrompt } from './conversational-ai-prompt.ts';
import { sendWhatsAppMessage } from '../_shared/evolutionClient.ts';
import { BASE_TOOLS, getBaseToolDefinition } from './base-tools.ts';
import { updateCustomerInsightsAfterOrder, getCustomerInsights } from '../_shared/customerInsights.ts';
import { buildConversationContext } from './context-builder.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let interactionLog: any;
  let supabase: any;

  try {
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
    
    supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize interaction log
    interactionLog = {
      restaurant_id: restaurantId,
      customer_phone: customerPhone,
      user_message: rawMessage,
      errors: [],
      has_errors: false,
      log_level: 'info'
    };

    // ============================================================
    // CHECK IF CONVERSATION IS IN MANUAL MODE
    // ============================================================
    
    console.log('[Mode Check] Checking conversation mode...');
    
    const { data: conversationMode } = await supabase
      .from('conversation_mode')
      .select('mode, taken_over_by')
      .eq('restaurant_id', restaurantId)
      .eq('user_phone', customerPhone)
      .maybeSingle();

    if (conversationMode?.mode === 'manual') {
      console.log(`[Mode Check] ⚠️ Conversation in MANUAL mode (taken over by user ${conversationMode.taken_over_by})`);
      console.log('[Mode Check] Skipping AI processing - human agent is in control');
      return new Response(
        JSON.stringify({ 
          skipped: true, 
          reason: 'manual_mode',
          message: 'Conversation is in manual mode - AI agent skipped' 
        }), 
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('[Mode Check] ✅ Conversation in AI mode - proceeding with AI agent\n');

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
    
    // Extract token optimization config early (needed for context builder)
    const tokenOptimizationConfig = conversationalAgent?.behavior_config?.token_optimization || null;
    if (tokenOptimizationConfig) {
      console.log(`[Agent Config] Token Optimization: ✅ Loaded from DB`);
      console.log(`[Agent Config]   - History: ${tokenOptimizationConfig.history_inbound_limit || 3} inbound + ${tokenOptimizationConfig.history_outbound_limit || 2} outbound`);
      console.log(`[Agent Config]   - Truncate: ${tokenOptimizationConfig.history_message_truncate_length || 80} chars`);
    } else {
      console.log(`[Agent Config] Token Optimization: ⚠️ Using defaults (no DB config)`);
    }
    
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
      rawMessage,
      tokenOptimizationConfig  // Pass token optimization config
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
      customerInsights,
      pendingItems,
      conversationState,
      lastShownProducts,
      cartTotal,
      currentState,
      stateMetadata,
      formatted
    } = context;

    // Log context loaded
    interactionLog.state_before = currentState;
    interactionLog.context_loaded = {
      menu_count: availableProducts.length,
      cart_items: cartItems.length,
      cart_total: cartTotal,
      customer: customer ? { name: customer.name, phone: customer.phone, has_address: !!customer.default_address } : null,
      customer_insights: customerInsights ? { order_count: customerInsights.order_count, average_ticket: customerInsights.average_ticket } : null,
      pending_items: pendingItems.length,
      conversation_history_length: conversationHistory.length
    };

    // ============================================================
    // STEP 2: CALL ORDER ORCHESTRATOR
    // ============================================================
    
    console.log('[Orchestrator] ========== CALLING ORCHESTRATOR ==========');
    console.log('[Orchestrator] Context being passed:');
    console.log(`[Orchestrator]   - History: ${conversationHistory.length} messages (FULL)`);
    console.log(`[Orchestrator]   - State: ${currentState}`);
    console.log(`[Orchestrator]   - Pending Items: ${pendingItems.length} items`);
    console.log(`[Orchestrator]   - Cart: ${cartItems.length} items`);
    
    // Build orchestrator system prompt
    const orchestratorFallbackPrompt = buildOrchestratorPrompt({
      userMessage: rawMessage,
      currentState,
      cartItems,
      cartTotal,
      menuProducts: availableProducts,
      restaurantName: restaurant.name,
      conversationHistory,
      pendingItems
    });
    
    let orchestratorSystemPrompt = buildSystemPromptFromBlocks(
      orchestratorPromptBlocks,
      orchestratorFallbackPrompt
    );
    
    if (useOrchestratorDB && orchestratorPromptBlocks.length > 0) {
      // Build menu categories string for RAG
      const menuCategories = [...new Set(availableProducts.map((p: any) => p.category).filter(Boolean))].join(' | ');
      
      // Apply template variables using unified formatted context
      // CRITICAL: All variables used in agent_prompt_blocks must be passed here!
      orchestratorSystemPrompt = applyTemplateVariables(orchestratorSystemPrompt, {
        restaurant_name: restaurant.name,
        user_message: rawMessage,
        menu_products: formatted.menu,
        menu_categories: menuCategories,
        cart_summary: formatted.cart,
        customer_info: formatted.customer,
        conversation_history: formatted.history,
        current_state: currentState,
        pending_items: formatted.pendingItems
      });
      
      console.log('[Orchestrator] ✅ Using database-configured prompt with template variables');
      console.log('[Orchestrator] Variables applied: restaurant_name, user_message, menu_products, menu_categories, cart_summary, customer_info, conversation_history, current_state, pending_items');
    } else {
      console.log('[Orchestrator] ⚠️ Using fallback hard-coded prompt');
    }
    
    console.log(`[Orchestrator] Prompt length: ${orchestratorSystemPrompt.length} characters`);
    console.log(`[Orchestrator] Prompt blocks used: ${orchestratorPromptBlocks.length}`);

    // Helper function to determine correct API parameters based on model
    // Newer models (gpt-5, o1, o3, o4) require max_completion_tokens and don't support temperature
    const isNewerModel = (model: string) => {
      const newModelPatterns = ['gpt-5', 'o1', 'o1-mini', 'o1-preview', 'o3', 'o4'];
      return newModelPatterns.some(pattern => model.toLowerCase().includes(pattern));
    };
    
    const getModelParams = (model: string, maxTokens: number, temperature?: number) => {
      if (isNewerModel(model)) {
        // Newer models: use max_completion_tokens, no temperature (defaults to 1)
        return { max_completion_tokens: maxTokens };
      }
      // Legacy models: use max_tokens and temperature
      return { 
        max_tokens: maxTokens,
        temperature: temperature ?? 1.0
      };
    };

    // ============================================================
    // PHASE 1.1: DYNAMIC MAX_TOKENS BY INTENT
    // Uses tokenOptimizationConfig extracted earlier (line ~114)
    // Falls back to defaults if not configured
    // ============================================================
    
    const getMaxTokensByIntent = (intent: string): number => {
      // Default token limits
      const defaultLimits: Record<string, number> = {
        // Simple intents - minimal response needed
        'greeting': 150,
        'acknowledgment': 100,
        'unclear': 150,
        'needs_human': 200,
        
        // Medium intents - moderate response
        'browse_menu': 350,
        'browse_product': 400,
        'confirm_item': 300,
        'provide_address': 250,
        'provide_payment': 200,
        
        // Complex intents - full response
        'finalize': 500,
        'manage_pending_items': 450,
        'prefilled_order': 400,
        'security_threat': 150
      };
      
      // Use database config if available, otherwise use defaults
      const configuredLimits = tokenOptimizationConfig?.max_tokens_by_intent || defaultLimits;
      return configuredLimits[intent] || defaultLimits[intent] || 400;
    };

    const orchestratorModel = orchestratorAgent?.model || 'gpt-4o';
    const orchestratorResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: orchestratorModel,
        messages: [
          { role: 'system', content: orchestratorSystemPrompt },
          { role: 'user', content: `Classifique esta mensagem do cliente: "${rawMessage}"` }
        ],
        ...getModelParams(orchestratorModel, orchestratorAgent?.max_tokens || 500, orchestratorAgent?.temperature),
        ...(orchestratorAgent?.top_p !== null && orchestratorAgent?.top_p !== undefined && !isNewerModel(orchestratorModel) && { top_p: orchestratorAgent.top_p }),
        ...(orchestratorAgent?.frequency_penalty !== null && orchestratorAgent?.frequency_penalty !== undefined && !isNewerModel(orchestratorModel) && { frequency_penalty: orchestratorAgent.frequency_penalty }),
        ...(orchestratorAgent?.presence_penalty !== null && orchestratorAgent?.presence_penalty !== undefined && !isNewerModel(orchestratorModel) && { presence_penalty: orchestratorAgent.presence_penalty }),
        response_format: { type: "json_object" }
      }),
    });

    if (!orchestratorResponse.ok) {
      const errorText = await orchestratorResponse.text();
      console.error('[Orchestrator] Error:', errorText);
      throw new Error(`Orchestrator failed: ${orchestratorResponse.status}`);
    }

    const orchestratorData = await orchestratorResponse.json();
    
    // Track Orchestrator tokens
    let orchestratorTokens = 0;
    if (orchestratorData?.usage) {
      orchestratorTokens = orchestratorData.usage.total_tokens || 0;
      console.log(`[Orchestrator] Tokens used: ${orchestratorTokens} (prompt: ${orchestratorData.usage.prompt_tokens}, completion: ${orchestratorData.usage.completion_tokens})`);
    }
    
    // Safety check for empty or malformed response
    const rawContent = orchestratorData?.choices?.[0]?.message?.content;
    console.log('[Orchestrator] Raw response content:', rawContent);
    
    let decision: { intent: string; target_state: string; confidence: number; reasoning: string };
    
    if (!rawContent || rawContent.trim() === '') {
      console.error('[Orchestrator] Empty response from model, using default intent');
      decision = {
        intent: 'unclear',
        target_state: currentState || 'idle',
        confidence: 0,
        reasoning: 'Model returned empty response'
      };
    } else {
      try {
        decision = JSON.parse(rawContent);
      } catch (parseError) {
        console.error('[Orchestrator] JSON parse error:', parseError, 'Content:', rawContent);
        decision = {
          intent: 'unclear',
          target_state: currentState || 'idle',
          confidence: 0,
          reasoning: 'Failed to parse model response'
        };
      }
    }
    
    console.log('[Orchestrator] Intent Classification:', JSON.stringify(decision, null, 2));
    console.log(`[Orchestrator] → Intent: ${decision.intent}`);
    console.log(`[Orchestrator] → Target State: ${decision.target_state}`);
    console.log(`[Orchestrator] → Confidence: ${decision.confidence}`);
    console.log(`[Orchestrator] → Reasoning: ${decision.reasoning}`);

    // Log orchestrator results
    interactionLog.orchestrator_intent = decision.intent;
    interactionLog.orchestrator_confidence = decision.confidence;
    interactionLog.orchestrator_target_state = decision.target_state;
    interactionLog.orchestrator_reasoning = decision.reasoning;

    // ============================================================
    // STEP 3: ITERATIVE FUNCTION CALLING LOOP
    // ============================================================
    
    console.log('\n[Main AI] ========== ITERATIVE FUNCTION CALLING ==========');
    
    const { intent, target_state: targetState, confidence } = decision;
    
    console.log('[Main AI] Context being passed:');
    console.log(`[Main AI]   - History: ${conversationHistory.length} messages (FULL - SAME AS ORCHESTRATOR)`);
    console.log(`[Main AI]   - State: ${currentState}`);
    console.log(`[Main AI]   - Target State: ${targetState}`);
    console.log(`[Main AI]   - Intent: ${intent}`);
    console.log(`[Main AI]   - Pending Items: ${pendingItems.length} items`);
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
    
    // Build conversational AI system prompt with ALL restaurant settings
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
      pendingItems,
      // Inject restaurant AI settings into prompt
      tone: restaurantAISettings?.tone,
      greetingMessage: restaurantAISettings?.greeting_message,
      closingMessage: restaurantAISettings?.closing_message,
      upsellAggressiveness: restaurantAISettings?.upsell_aggressiveness,
      maxAdditionalQuestions: restaurantAISettings?.max_additional_questions_before_checkout,
      language: restaurantAISettings?.language,
      customInstructions: restaurantAISettings?.custom_instructions,
      businessRules: restaurantAISettings?.business_rules,
      faqResponses: restaurantAISettings?.faq_responses,
      unavailableItemsHandling: restaurantAISettings?.unavailable_items_handling,
      specialOffersInfo: restaurantAISettings?.special_offers_info
    });
    
    let conversationalSystemPrompt = buildSystemPromptFromBlocks(
      conversationalPromptBlocks,
      conversationalFallbackPrompt
    );
    
    // ============================================================
    // PHASE 2: CACHE-OPTIMIZED MESSAGE STRUCTURE (REAL IMPLEMENTATION)
    // Split FIXED (cacheable) content from DYNAMIC content
    // 
    // FIXED variables (change rarely per restaurant):
    //   - restaurant_name, menu_categories, menu_url
    //   - tone, custom_instructions, business_rules, etc.
    // 
    // DYNAMIC variables (change every message):
    //   - current_state, target_state, user_intent
    //   - cart_summary, pending_items, customer_info
    //   - conversation_history, user_message
    // ============================================================
    
    // Build menu categories string for RAG
    const menuCategories = [...new Set(availableProducts.map((p: any) => p.category).filter(Boolean))].join(' | ');
    
    if (useConversationalDB && conversationalPromptBlocks.length > 0) {
      // ============================================================
      // STEP 1: Apply ONLY FIXED variables to system prompt (CACHEABLE)
      // ============================================================
      conversationalSystemPrompt = applyTemplateVariables(conversationalSystemPrompt, {
        // Restaurant identity (rarely changes)
        restaurant_name: restaurant.name,
        restaurant_info: formatted.restaurantInfo,
        
        // Menu (changes only when menu is updated)
        menu_products: formatted.menu,
        menu_categories: menuCategories,
        menu_url: context.menuUrl || '',
        
        // Restaurant AI Settings (changes rarely)
        tone: restaurantAISettings?.tone || 'friendly',
        greeting_message: restaurantAISettings?.greeting_message || '',
        closing_message: restaurantAISettings?.closing_message || '',
        upsell_aggressiveness: restaurantAISettings?.upsell_aggressiveness || 'medium',
        custom_instructions: restaurantAISettings?.custom_instructions || '',
        business_rules: restaurantAISettings?.business_rules || '',
        faq_responses: restaurantAISettings?.faq_responses || '',
        special_offers_info: restaurantAISettings?.special_offers_info || '',
        unavailable_items_handling: restaurantAISettings?.unavailable_items_handling || '',
        
        // Placeholder markers for dynamic content (replaced with marker)
        current_state: '[VER CONTEXTO DINÂMICO]',
        target_state: '[VER CONTEXTO DINÂMICO]',
        user_intent: '[VER CONTEXTO DINÂMICO]',
        cart_summary: '[VER CONTEXTO DINÂMICO]',
        pending_items: '[VER CONTEXTO DINÂMICO]',
        customer_info: '[VER CONTEXTO DINÂMICO]',
        conversation_history: '[VER CONTEXTO DINÂMICO]',
        user_message: '[VER CONTEXTO DINÂMICO]',
        local_time: ''
      });
      
      // Apply prompt overrides if any (restaurant-specific customizations)
      if (promptOverrides && promptOverrides.length > 0) {
        console.log('[Main AI] Applying restaurant-specific prompt overrides');
        promptOverrides.forEach((override: any) => {
          console.log(`[Main AI]   - Overriding block: ${override.block_key}`);
          conversationalSystemPrompt += `\n\n# RESTAURANT OVERRIDE: ${override.block_key}\n\n${override.content}\n`;
        });
      }
      
      console.log('[Main AI] ✅ CACHE OPTIMIZATION: Fixed variables applied to system prompt');
      console.log('[Main AI]   Fixed: restaurant_name, menu_categories, tone, custom_instructions, etc.');
    } else {
      console.log('[Main AI] ⚠️ Using fallback hard-coded prompt');
    }
    
    // ============================================================
    // STEP 2: Build DYNAMIC context (goes in user message)
    // This changes every message but doesn't invalidate cache
    // ============================================================
    const dynamicContext = `
═══════════════════════════════════════════════════════════════
📊 CONTEXTO DINÂMICO DA CONVERSA (atualizado a cada mensagem)
═══════════════════════════════════════════════════════════════

**ESTADO:** ${currentState} → ${targetState}
**INTENT:** ${intent}
**CLIENTE:** ${formatted.customer}
**CARRINHO:** ${formatted.cart}
**PENDENTES:** ${formatted.pendingItems}

**HISTÓRICO RECENTE:**
${formatted.history}

═══════════════════════════════════════════════════════════════
📩 MENSAGEM DO CLIENTE:
${rawMessage}
═══════════════════════════════════════════════════════════════
`.trim();

    console.log(`[Main AI] Prompt fixo (cacheable): ${conversationalSystemPrompt.length} chars`);
    console.log(`[Main AI] Contexto dinâmico: ${dynamicContext.length} chars`);
    console.log(`[Main AI] ✅ Cache hit potencial: ~${Math.round((1 - dynamicContext.length / (conversationalSystemPrompt.length + dynamicContext.length)) * 100)}%`);

    // Log AI request details
    interactionLog.system_prompt = conversationalSystemPrompt;
    interactionLog.prompt_length = conversationalSystemPrompt.length;
    interactionLog.ai_request = {
      model: conversationalAgent?.model || 'gpt-4o',
      tools_count: tools.length,
      temperature: conversationalAgent?.temperature ?? 0.7,
      max_tokens: conversationalAgent?.max_tokens || 1000,
      top_p: conversationalAgent?.top_p,
      frequency_penalty: conversationalAgent?.frequency_penalty,
      presence_penalty: conversationalAgent?.presence_penalty,
      cache_optimization: true,
      fixed_prompt_length: conversationalSystemPrompt.length,
      dynamic_context_length: dynamicContext.length
    };

    // PHASE 1.1: Get dynamic max_tokens based on intent
    const dynamicMaxTokens = getMaxTokensByIntent(intent);
    console.log(`[Token Optimization] Using max_tokens: ${dynamicMaxTokens} for intent: ${intent}`);
    
    // ============================================================
    // STEP 3: Build messages array with FIXED system + DYNAMIC user
    // This structure maximizes OpenAI prompt cache hit rate
    // ============================================================
    const messages: any[] = [
      { role: 'system', content: conversationalSystemPrompt },  // FIXED - cacheable!
      { role: 'user', content: dynamicContext }                  // DYNAMIC - changes each message
    ];
    
    let finalResponse = '';
    let allToolCallsRaw: any[] = [];
    let allToolCallsValidated: any[] = [];
    let allToolResults: any[] = [];
    const MAX_ITERATIONS = 5; // Prevent infinite loops
    let iterations = 0;
    let totalTokensUsed = orchestratorTokens; // Start with Orchestrator tokens
    
    // State management variables
    // FIX: Forçar transição de estado baseado no target_state do Orchestrator
    // O Orchestrator define para onde a conversa DEVE ir, não apenas classifica
    let newState = (targetState === 'unknown' || !targetState) ? currentState : targetState;
    console.log(`[State Machine] Orchestrator target_state: ${targetState} → newState: ${newState}`);
    
    let newMetadata = { ...stateMetadata };
    let finalizeSuccess = false;
    let cartModified = false;
    
    console.log('\n[Iterative Loop] Starting iterative function calling loop...');
    console.log(`[Iterative Loop] Initial messages count: ${messages.length} (history in system prompt only)`);
    
    // CRITICAL FIX: Force tool usage for browse intents
    // This prevents AI from responding "não temos" without calling search_menu
    const shouldForceToolUse = ['browse_product', 'browse_menu'].includes(intent) && tools.length > 0 && iterations === 0;
    if (shouldForceToolUse) {
      console.log(`[Tool Forcing] ⚠️ Intent is ${intent} - forcing tool_choice: required for first iteration`);
    }
    
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      console.log(`\n[Iteration ${iterations}] ========== CALLING AI ==========`);
      
      // Only force tool use on first iteration for browse intents
      const forceToolsThisIteration = shouldForceToolUse && iterations === 1;
      
      const conversationalModel = conversationalAgent?.model || 'gpt-4o';
      
      // PHASE 1.1: Use dynamic max_tokens based on intent (overrides DB config for optimization)
      const effectiveMaxTokens = Math.min(dynamicMaxTokens, conversationalAgent?.max_tokens || 800);
      
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: conversationalModel,
          messages,
          ...(tools.length > 0 && { tools }),
          // Force tool_choice: required for browse intents on first iteration
          ...(forceToolsThisIteration && { tool_choice: 'required' }),
          ...getModelParams(conversationalModel, effectiveMaxTokens, conversationalAgent?.temperature),
          ...(conversationalAgent?.top_p !== null && conversationalAgent?.top_p !== undefined && !isNewerModel(conversationalModel) && { top_p: conversationalAgent.top_p }),
          ...(conversationalAgent?.frequency_penalty !== null && conversationalAgent?.frequency_penalty !== undefined && !isNewerModel(conversationalModel) && { frequency_penalty: conversationalAgent.frequency_penalty }),
          ...(conversationalAgent?.presence_penalty !== null && conversationalAgent?.presence_penalty !== undefined && !isNewerModel(conversationalModel) && { presence_penalty: conversationalAgent.presence_penalty })
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`[Iteration ${iterations}] AI Error:`, errorText);
        throw new Error(`Main AI failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const choice = aiData.choices[0];
      const assistantMessage = choice.message;
      const finishReason = choice.finish_reason;
      
      // Track token usage from this iteration
      if (aiData.usage) {
        totalTokensUsed += aiData.usage.total_tokens || 0;
        console.log(`[Iteration ${iterations}] Tokens used: ${aiData.usage.total_tokens} (prompt: ${aiData.usage.prompt_tokens}, completion: ${aiData.usage.completion_tokens})`);
      }
      
      console.log(`[Iteration ${iterations}] Finish reason: ${finishReason}`);
      console.log(`[Iteration ${iterations}] Has tool_calls: ${!!assistantMessage.tool_calls}`);
      console.log(`[Iteration ${iterations}] Has content: ${!!assistantMessage.content}`);
      
      // Add assistant message to history (important for tool call cycle)
      messages.push(assistantMessage);
      
      // If no tool calls, AI finished - extract final response
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        finalResponse = assistantMessage.content || '';
        console.log(`[Iteration ${iterations}] ✅ AI finished with final response`);
        console.log(`[Iteration ${iterations}] Response preview: "${finalResponse.substring(0, 150)}..."`);
        break;
      }
      
      // Process tool calls
      const toolCalls = assistantMessage.tool_calls;
      allToolCallsRaw.push(...toolCalls);
      
      console.log(`[Iteration ${iterations}] Tool calls received: ${toolCalls.length}`);
      toolCalls.forEach((tc: any, idx: number) => {
        console.log(`[Iteration ${iterations}]   ${idx + 1}. ${tc.function.name}(${tc.function.arguments})`);
      });
      
      // Validate and execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        console.log(`\n[Tool Execution] ────────────────────────────────`);
        console.log(`[Tool Execution] Executing: ${functionName}`);
        console.log(`[Tool Execution] Arguments:`, JSON.stringify(args, null, 2));
        
        // Execute the tool and get result
        const toolResult = await executeToolCall(
          supabase,
          functionName,
          args,
          {
            restaurantId,
            customerPhone,
            availableProducts,
            activeCart,
            cartItems,
            rawMessage,
            intent,
            confidence,
            newState,
            newMetadata,
            pendingItems,
            restaurant,
            menuUrl: context.menuUrl
          }
        );
        
        // Update state based on tool result
        if (toolResult.stateUpdate) {
          if (toolResult.stateUpdate.newState) newState = toolResult.stateUpdate.newState;
          if (toolResult.stateUpdate.newMetadata) newMetadata = { ...newMetadata, ...toolResult.stateUpdate.newMetadata };
          if (toolResult.stateUpdate.activeCart !== undefined) activeCart = toolResult.stateUpdate.activeCart;
          if (toolResult.stateUpdate.cartModified) cartModified = true;
          if (toolResult.stateUpdate.finalizeSuccess) finalizeSuccess = true;
        }
        
        allToolCallsValidated.push(toolCall);
        allToolResults.push({
          tool_call_id: toolCall.id,
          function_name: functionName,
          result: toolResult.output
        });
        
        // Add tool result to messages array - THIS IS THE KEY FIX!
        // The AI will now SEE the results of its tool calls
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.output)
        });
        
        console.log(`[Tool Execution] ✅ Result added to messages with role: "tool"`);
        console.log(`[Tool Execution] Result preview:`, JSON.stringify(toolResult.output).substring(0, 200));
      }
      
      console.log(`\n[Iteration ${iterations}] Messages count after tools: ${messages.length}`);
      console.log(`[Iteration ${iterations}] Continuing to next iteration to get AI response with tool results...`);
    }
    
    if (iterations >= MAX_ITERATIONS) {
      console.warn(`[Iterative Loop] ⚠️ Max iterations (${MAX_ITERATIONS}) reached - stopping loop`);
    }
    
    // POST-RESPONSE VALIDATION: Check if browse intent didn't trigger search_menu
    if (['browse_product', 'browse_menu'].includes(intent)) {
      const searchMenuCalled = allToolCallsValidated.some(tc => tc.function?.name === 'search_menu');
      if (!searchMenuCalled) {
        console.error(`[VALIDATION ERROR] ❌ Intent was ${intent} but search_menu was NOT called!`);
        console.error(`[VALIDATION ERROR] This indicates the AI responded without consulting the menu.`);
        console.error(`[VALIDATION ERROR] Response given: "${finalResponse.substring(0, 100)}..."`);
      } else {
        console.log(`[VALIDATION] ✅ search_menu was correctly called for ${intent} intent`);
      }
    }
    
    console.log(`\n[Iterative Loop] ========== LOOP COMPLETE ==========`);
    console.log(`[Iterative Loop] Total iterations: ${iterations}`);
    console.log(`[Iterative Loop] Total tool calls (raw): ${allToolCallsRaw.length}`);
    console.log(`[Iterative Loop] Total tool calls (validated): ${allToolCallsValidated.length}`);
    console.log(`[Iterative Loop] Final response length: ${finalResponse.length} chars`);
    
    // Log AI response
    interactionLog.ai_response_raw = { iterations, messages_count: messages.length };
    interactionLog.ai_response_text = finalResponse;
    interactionLog.tool_calls_requested = allToolCallsRaw;
    interactionLog.tool_calls_validated = allToolCallsValidated;
    interactionLog.tool_execution_results = allToolResults;
    
    // ============================================================
    // RE-FETCH CART DATA AFTER MODIFICATIONS
    // ============================================================
    
    if (cartModified) {
      console.log('\n[Cart Refresh] ========== RE-FETCHING CART DATA ==========');
      
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
    
    // ============================================================
    // FALLBACK: Generate response if AI didn't provide one
    // ============================================================
    
    console.log(`\n[Response] ========== RESPONSE CONSTRUCTION ==========`);
    console.log(`[Response] Tool calls executed: ${allToolCallsValidated.length}`);
    console.log(`[Response] AI-generated message: "${finalResponse || '(empty)'}"`);
    
    // If AI didn't provide a message after tool execution, construct fallback
    if ((!finalResponse || finalResponse.trim() === '') && allToolCallsValidated.length > 0) {
      console.log('[Response] ⚠️ AI returned empty response after tools, constructing fallback...');
      
      const confirmations: string[] = [];
      
      for (const toolResult of allToolResults) {
        const { function_name, result } = toolResult;
        
        switch (function_name) {
          case 'search_menu': {
            if (result.found && result.products && result.products.length > 0) {
              const productList = result.products
                .slice(0, 5)
                .map((p: any) => `• ${p.name} - €${p.price.toFixed(2)}`)
                .join('\n');
              confirmations.push(`🔍 Encontrei estas opções:\n${productList}`);
            } else {
              confirmations.push(`❌ Não encontrei produtos para essa busca.`);
            }
            break;
          }
          
          case 'add_to_cart': {
            if (result.success) {
              confirmations.push(`✅ ${result.message || 'Produto adicionado ao carrinho!'}`);
            }
            break;
          }
          
          case 'validate_and_set_delivery_address': {
            if (result.valid === true) {
              confirmations.push(`📍 Endereço confirmado! Taxa de entrega: €${result.delivery_fee?.toFixed(2) || '0.00'}.`);
            } else if (result.valid === false) {
              confirmations.push(`❌ ${result.message || 'Endereço fora da área de entrega.'}`);
            }
            break;
          }
          
          case 'set_payment_method': {
            const methodNames: { [key: string]: string } = {
              cash: 'Dinheiro',
              card: 'Cartão',
              mbway: 'MBWay'
            };
            confirmations.push(`💳 Pagamento: ${methodNames[result.method] || result.method}`);
            break;
          }
          
          case 'finalize_order': {
            if (result.success) {
              confirmations.push(`🎉 ${result.message || 'Pedido confirmado!'}`);
            } else {
              confirmations.push(`⚠️ ${result.message || 'Não foi possível finalizar o pedido.'}`);
            }
            break;
          }
          
          default:
            if (result.message) {
              confirmations.push(result.message);
            }
        }
      }
      
      finalResponse = confirmations.join('\n\n');
      console.log(`[Response] Fallback message constructed: "${finalResponse.substring(0, 150)}..."`);
    }
    
    // CRITICAL CHECK: If we still have no response, something went wrong
    if (!finalResponse || finalResponse.trim() === '') {
      console.error('[Response] ❌ CRITICAL: No response generated');
      finalResponse = 'Desculpa, ocorreu um erro ao processar o teu pedido. Podes tentar novamente?';
    }
    
    console.log(`[Response] Final message to send: "${finalResponse.substring(0, 150)}..."`);
    console.log(`[Response] Message length: ${finalResponse.length} characters`);

    // ============================================================
    // STEP 5: UPDATE STATE & SEND RESPONSE
    // ============================================================
    
    console.log('\n[State Update] ========== UPDATING STATE ==========');
    console.log(`[State Update] State transition: ${currentState} → ${newState}`);
    console.log(`[State Update] Pending items: ${pendingItems.length} items`);
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
          direction: 'outbound',
          sent_by: 'ai'
        });

      if (messageError) {
        console.error('[Messages] ❌ Failed to save AI response:', messageError);
        throw messageError;
      }
      
      console.log('[Messages] ✅ AI response saved to database');
    } catch (saveError) {
      console.error('[Messages] ❌ Exception saving AI response:', saveError);
    }

    console.log('\n[WhatsApp] ========== SENDING RESPONSE ==========');
    
    console.log(`[WhatsApp] Message to send: "${finalResponse.substring(0, 150)}${finalResponse.length > 150 ? '...' : ''}"`);
    console.log(`[WhatsApp] Message length: ${finalResponse.length} characters`);
    
    // Get restaurant's WhatsApp instance
    const { data: whatsappInstance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, status')
      .eq('restaurant_id', restaurantId)
      .single();

    const instanceName = whatsappInstance?.instance_name || Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'default';
    
    // Send WhatsApp response
    try {
      await sendWhatsAppMessage(instanceName, customerPhone, finalResponse);
      console.log('[WhatsApp] ✅ Message sent successfully');
    } catch (whatsappError: any) {
      console.warn(`[WhatsApp] ⚠️ Failed to send WhatsApp (test mode?): ${whatsappError.message}`);
    }
    
    // ============================================================
    // LOG INTERACTION & METRICS
    // ============================================================
    
    const processingTime = Date.now() - startTime;
    
    console.log(`[Metrics] ${JSON.stringify({
      orchestrator_intent: intent,
      target_state: targetState,
      tools_called_raw: allToolCallsRaw.length,
      tools_executed: allToolCallsValidated.length,
      iterations: iterations,
      ai_response_empty: !finalResponse,
      processing_time_ms: processingTime,
      state_transition: `${currentState} → ${newState}`
    })}`);
    
    // Save interaction log
    try {
      interactionLog.state_after = newState;
      interactionLog.final_response = finalResponse;
      interactionLog.processing_time_ms = processingTime;
      interactionLog.tokens_used = totalTokensUsed > 0 ? totalTokensUsed : null;
      interactionLog.has_errors = interactionLog.errors.length > 0;
      
      await supabase.from('ai_interaction_logs').insert(interactionLog);
      console.log('[Logging] ✅ Interaction log saved to database');
      
      // Increment subscription token usage
      if (totalTokensUsed > 0) {
        try {
          await supabase.rpc('increment_subscription_tokens', {
            p_restaurant_id: restaurantId,
            p_tokens: totalTokensUsed
          });
          console.log(`[Tokens] ✅ Subscription tokens incremented by ${totalTokensUsed}`);
        } catch (tokenError) {
          console.error('[Tokens] ⚠️ Failed to increment subscription tokens:', tokenError);
        }
      }
    } catch (logError) {
      console.error('[Logging] ❌ Failed to save interaction log:', logError);
    }

    console.log(`[Summary] Tools called (raw): ${allToolCallsRaw.length}`);
    console.log(`[Summary] Tools executed (validated): ${allToolCallsValidated.length}`);
    console.log(`[Summary] Iterations: ${iterations}`);
    console.log(`[Summary] Intent classified: ${intent} (confidence: ${confidence})`);
    console.log(`[Summary] State transition: ${currentState} → ${newState}`);
    console.log(`[Summary] Pending items: ${pendingItems.length} items`);
    console.log(`[Summary] Processing time: ${processingTime} ms`);
    console.log(`[Summary] Total tokens used: ${totalTokensUsed}`);
    console.log(`[Summary] ===============================================\n`);

    return new Response(
      JSON.stringify({
        success: true,
        message: finalResponse,
        state: newState,
        intent,
        confidence,
        iterations,
        tools_executed: allToolCallsValidated.length,
        processing_time_ms: processingTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CRITICAL ERROR]', error);
    
    // Log error
    if (interactionLog) {
      interactionLog.errors.push({
        type: 'critical',
        message: error.message,
        stack: error.stack
      });
      interactionLog.has_errors = true;
      interactionLog.log_level = 'error';
      
      try {
        if (supabase) {
          await supabase.from('ai_interaction_logs').insert(interactionLog);
        }
      } catch (logError) {
        console.error('[Logging] Failed to save error log:', logError);
      }
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================
// TOOL EXECUTION FUNCTION
// Executes a single tool and returns the result
// ============================================================

interface ToolExecutionContext {
  restaurantId: string;
  customerPhone: string;
  availableProducts: any[];
  activeCart: any;
  cartItems: any[];
  rawMessage: string;
  intent: string;
  confidence: number;
  newState: string;
  newMetadata: any;
  pendingItems: any[];
  restaurant: any;
  menuUrl: string;
}

interface ToolExecutionResult {
  output: any;
  stateUpdate?: {
    newState?: string;
    newMetadata?: any;
    activeCart?: any;
    cartModified?: boolean;
    finalizeSuccess?: boolean;
  };
}

async function executeToolCall(
  supabase: any,
  functionName: string,
  args: any,
  ctx: ToolExecutionContext
): Promise<ToolExecutionResult> {
  
  const { 
    restaurantId, customerPhone, availableProducts, activeCart, 
    cartItems, rawMessage, intent, confidence, newState, newMetadata, 
    pendingItems, restaurant, menuUrl 
  } = ctx;
  
  let currentActiveCart = activeCart;
  let stateUpdate: ToolExecutionResult['stateUpdate'] = {};
  
  switch (functionName) {
    case 'search_menu': {
      const { query, category, max_results = 5 } = args;
      
      console.log(`[Tool] 🔍 Searching menu for "${query || '(category only)'}" (category: ${category || 'all'}, max: ${max_results})`);
      
      // Handle empty search - return categories
      if (!query && !category) {
        const categories = [...new Set(
          availableProducts
            .filter(p => p && p.category)
            .map(p => p.category)
        )].sort();
        
        return {
          output: {
            found: true,
            type: 'categories',
            count: categories.length,
            categories: categories,
            message: `Categorias disponíveis: ${categories.join(', ')}`
          }
        };
      }
      
      // Perform search
      const results = searchProducts(availableProducts, query, category, max_results);
      
      // Save results for positional selection
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
      
      console.log(`[Tool] ✅ Found ${results.length} results`);
      
      if (results.length === 0) {
        return {
          output: {
            found: false,
            count: 0,
            products: [],
            message: `Não encontrei "${query || category}" no menu. Posso mostrar as categorias disponíveis?`
          }
        };
      }
      
      return {
        output: {
          found: true,
          count: results.length,
          products: results.map(r => ({
            id: r.product.id,
            name: r.product.name,
            price: r.product.price,
            category: r.product.category,
            description: r.product.description,
            similarity: r.similarity,
            addons: r.product.addons || []
          }))
        }
      };
    }
    
    case 'add_to_cart': {
      const { product_id, quantity = 1, addon_ids = [], notes } = args;
      
      const product = availableProducts.find(p => p.id === product_id);
      if (!product) {
        console.error(`[Tool] Product not found: ${product_id}`);
        return { output: { success: false, error: 'Produto não encontrado' } };
      }
      
      // CRITICAL: Validate addon_ids belong to this product
      let validatedAddons: any[] = [];
      let invalidAddons: string[] = [];
      
      if (addon_ids && addon_ids.length > 0) {
        // Fetch addons that belong to this product
        const { data: productAddons } = await supabase
          .from('addons')
          .select('id, name, price')
          .eq('product_id', product_id);
        
        const validAddonIds = new Set((productAddons || []).map((a: { id: string }) => a.id));
        
        for (const addonId of addon_ids) {
          if (validAddonIds.has(addonId)) {
            const addon = productAddons?.find((a: { id: string }) => a.id === addonId);
            validatedAddons.push(addon);
          } else {
            invalidAddons.push(addonId);
            console.warn(`[Tool] ⚠️ Invalid addon ${addonId} for product ${product_id}`);
          }
        }
        
        if (invalidAddons.length > 0) {
          console.error(`[Tool] ❌ Rejected ${invalidAddons.length} invalid addons: ${invalidAddons.join(', ')}`);
        }
      }
      
      // Create cart if needed
      if (!currentActiveCart) {
        const { data: newCart } = await supabase
          .from('carts')
          .insert({
            restaurant_id: restaurantId,
            user_phone: customerPhone,
            status: 'active'
          })
          .select()
          .single();
        currentActiveCart = newCart;
        stateUpdate.activeCart = newCart;
      }
      
      // Add item to cart
      const { data: cartItem, error: addError } = await supabase
        .from('cart_items')
        .insert({
          cart_id: currentActiveCart!.id,
          product_id,
          quantity,
          notes
        })
        .select()
        .single();
      
      if (addError) {
        console.error('[Tool] Add to cart error:', addError);
        return { output: { success: false, error: addError.message } };
      }
      
      console.log(`[Tool] ✅ Added ${quantity}x ${product.name} to cart`);
      
      // Add ONLY validated addons
      if (validatedAddons.length > 0) {
        const addonInserts = validatedAddons.map((addon: any) => ({
          cart_item_id: cartItem.id,
          addon_id: addon.id
        }));
        
        await supabase.from('cart_item_addons').insert(addonInserts);
        console.log(`[Tool] ✅ Added ${validatedAddons.length} validated addons: ${validatedAddons.map(a => a.name).join(', ')}`);
      }
      
      stateUpdate.newState = 'confirming_item';
      stateUpdate.cartModified = true;
      
      // Calculate total with addons
      const addonsTotal = validatedAddons.reduce((sum, a) => sum + (a.price || 0), 0);
      const itemTotal = (product.price + addonsTotal) * quantity;
      
      return {
        output: {
          success: true,
          message: `Adicionei ${quantity}x ${product.name} ao carrinho!`,
          product_name: product.name,
          quantity,
          price: product.price,
          addons_added: validatedAddons.map(a => ({ name: a.name, price: a.price })),
          addons_rejected: invalidAddons.length > 0 ? invalidAddons : undefined,
          item_total: itemTotal
        },
        stateUpdate
      };
    }
    
    case 'remove_from_cart': {
      const { product_id } = args;
      
      if (!currentActiveCart) {
        return { output: { success: false, error: 'Carrinho vazio' } };
      }
      
      const { error: removeError } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', currentActiveCart.id)
        .eq('product_id', product_id);
      
      if (removeError) {
        return { output: { success: false, error: removeError.message } };
      }
      
      console.log(`[Tool] ✅ Removed product from cart`);
      stateUpdate.cartModified = true;
      
      return {
        output: { success: true, message: 'Produto removido do carrinho' },
        stateUpdate
      };
    }
    
    case 'clear_cart': {
      if (currentActiveCart) {
        await supabase
          .from('cart_items')
          .delete()
          .eq('cart_id', currentActiveCart.id);
        
        stateUpdate.cartModified = true;
        console.log('[Tool] ✅ Cleared cart');
      }
      
      return {
        output: { success: true, message: 'Carrinho limpo' },
        stateUpdate
      };
    }
    
    case 'show_cart': {
      const cartSummary = cartItems.map((item: any) => ({
        name: item.product_name,
        quantity: item.quantity,
        price: item.total_price,
        addons: item.addons?.map((a: any) => a.name) || []
      }));
      
      const total = cartItems.reduce((sum: number, item: any) => sum + item.total_price, 0);
      
      return {
        output: {
          success: true,
          items: cartSummary,
          total,
          message: cartItems.length > 0 
            ? `Carrinho: ${cartItems.length} items, Total: €${total.toFixed(2)}`
            : 'Carrinho vazio'
        }
      };
    }
    
    case 'send_menu_link': {
      console.log(`[Tool] 🔗 Sending menu link: ${menuUrl}`);
      
      if (!menuUrl) {
        return {
          output: {
            success: false,
            error: 'Menu público não está configurado para este restaurante.'
          }
        };
      }
      
      return {
        output: {
          success: true,
          menu_url: menuUrl,
          message: `Acesse nosso menu completo: ${menuUrl}`
        }
      };
    }
    
    case 'get_product_addons': {
      const { product_id } = args;
      
      if (!product_id) {
        return {
          output: {
            success: false,
            error: 'ID do produto não fornecido'
          }
        };
      }
      
      const product = availableProducts.find(p => p.id === product_id);
      if (!product) {
        return {
          output: {
            success: false,
            error: 'Produto não encontrado'
          }
        };
      }
      
      // Fetch addons from database
      const { data: addons, error: addonsError } = await supabase
        .from('addons')
        .select('id, name, price')
        .eq('product_id', product_id);
      
      if (addonsError) {
        console.error('[Tool] Error fetching addons:', addonsError);
        return {
          output: {
            success: false,
            error: 'Erro ao buscar complementos'
          }
        };
      }
      
      const hasAddons = addons && addons.length > 0;
      
      console.log(`[Tool] 🍕 Found ${addons?.length || 0} addons for ${product.name}`);
      
      return {
        output: {
          success: true,
          product_id,
          product_name: product.name,
          has_addons: hasAddons,
          addons: (addons || []).map((a: any) => ({
            id: a.id,
            name: a.name,
            price: a.price
          })),
          message: hasAddons 
            ? `${product.name} tem ${addons?.length} opção(ões) de complemento: ${addons?.map((a: any) => `${a.name} (+€${a.price.toFixed(2)})`).join(', ')}`
            : `${product.name} não tem complementos disponíveis.`
        }
      };
    }
    
    case 'validate_and_set_delivery_address': {
      const { address, latitude, longitude } = args;
      
      console.log(`[Tool] 🗺️ Validating address: ${address || 'GPS Location'}`);
      
      try {
        let lat: number;
        let lng: number;
        let formatted_address: string;
        
        // Check if GPS coordinates were provided directly (WhatsApp location)
        if (latitude !== undefined && longitude !== undefined) {
          // Use GPS coordinates directly - skip geocoding
          lat = latitude;
          lng = longitude;
          formatted_address = address || `Localização GPS (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
          console.log(`[Tool] 📍 Using GPS coordinates directly: ${lat}, ${lng} - "${formatted_address}"`);
        } else if (address) {
          // Step 1: Geocode the text address
          const { data: geocodeData, error: geocodeError } = await supabase.functions.invoke(
            'geocode-address-free',
            { body: { address } }
          );
          
          if (geocodeError || !geocodeData) {
            console.error('[Tool] Geocoding failed:', geocodeError);
            return {
              output: {
                valid: false,
                success: false,
                error: 'Não foi possível encontrar o endereço. Por favor, verifica se está correto.'
              }
            };
          }
          
          lat = geocodeData.lat;
          lng = geocodeData.lng;
          formatted_address = geocodeData.formatted_address;
          console.log(`[Tool] ✅ Geocoded: ${formatted_address} (${lat}, ${lng})`);
        } else {
          return {
            output: {
              valid: false,
              success: false,
              error: 'Por favor, forneça um endereço ou envie a sua localização pelo WhatsApp.'
            }
          };
        }
        console.log(`[Tool] ✅ Geocoded: ${formatted_address} (${lat}, ${lng})`);
        
        // Step 2: Validate against delivery zones
        // Include both cart items AND pending items in order amount calculation
        const cartTotal = cartItems.reduce((sum: any, item: any) => sum + (item.total_price || 0), 0);
        const pendingTotal = pendingItems.reduce((sum: any, item: any) => {
          const itemPrice = item.product?.price || 0;
          const qty = item.quantity || 1;
          return sum + (itemPrice * qty);
        }, 0);
        const orderAmount = cartTotal + pendingTotal;
        
        console.log(`[Tool] 🧮 Order amount calculation: cart=€${cartTotal.toFixed(2)}, pending=€${pendingTotal.toFixed(2)}, total=€${orderAmount.toFixed(2)}`);
        
        const { data: validationData, error: validationError } = await supabase.functions.invoke(
          'validate-delivery-address',
          { 
            body: { 
              restaurant_id: restaurantId, 
              lat, 
              lng,
              order_amount: orderAmount
            } 
          }
        );
        
        if (validationError || !validationData) {
          console.error('[Tool] Validation failed:', validationError);
          return {
            output: {
              valid: false,
              success: false,
              error: 'Erro ao validar endereço.'
            }
          };
        }
        
        // Process validation result
        if (validationData.valid) {
          stateUpdate.newMetadata = {
            delivery_address: formatted_address,
            delivery_coordinates: { lat, lng },
            delivery_zone: validationData.zone?.name || 'Desconhecida',
            delivery_fee: validationData.delivery_fee,
            estimated_delivery_time: validationData.estimated_time_minutes,
            distance_km: validationData.distance_km
          };
          stateUpdate.newState = 'collecting_payment';
          
          console.log(`[Tool] ✅ Address validated: Zone ${validationData.zone?.name}, Fee €${validationData.delivery_fee}`);
          
          return {
            output: {
              valid: true,
              success: true,
              address: formatted_address,
              zone: validationData.zone?.name,
              delivery_fee: validationData.delivery_fee,
              estimated_time_minutes: validationData.estimated_time_minutes,
              message: `Endereço confirmado! Taxa de entrega: €${validationData.delivery_fee.toFixed(2)}. Tempo estimado: ${validationData.estimated_time_minutes} min.`
            },
            stateUpdate
          };
        } else {
          // Use specific error message from validation function
          const errorReason = validationData.error || 'Endereço fora da área de entrega';
          console.log(`[Tool] ❌ Address validation failed: ${errorReason}`);
          
          return {
            output: {
              valid: false,
              success: false,
              address: formatted_address,
              reason: errorReason,
              message: errorReason.includes('Valor mínimo') 
                ? `${errorReason}. Adicione mais itens ao pedido para entregar neste endereço.`
                : `Infelizmente o endereço "${formatted_address}" está fora da nossa área de entrega.`
            }
          };
        }
      } catch (error: any) {
        console.error('[Tool] Address validation error:', error);
        return {
          output: {
            valid: false,
            success: false,
            error: error.message
          }
        };
      }
    }
    
    case 'set_payment_method': {
      const { method } = args;
      
      const validMethods = ['cash', 'card', 'mbway'];
      if (!validMethods.includes(method)) {
        return {
          output: {
            success: false,
            error: `Método de pagamento inválido. Opções: ${validMethods.join(', ')}`
          }
        };
      }
      
      stateUpdate.newMetadata = { payment_method: method };
      stateUpdate.newState = 'ready_to_order';
      
      console.log(`[Tool] ✅ Payment method set: ${method}`);
      
      return {
        output: {
          success: true,
          method,
          message: `Pagamento definido: ${method}`
        },
        stateUpdate
      };
    }
    
    case 'finalize_order': {
      // ============================================================
      // CHECKLIST PRÉ-FINALIZAÇÃO (V17)
      // Verifica todos os requisitos antes de criar o pedido
      // ============================================================
      console.log('[Tool] 📋 finalize_order - CHECKLIST PRÉ-FINALIZAÇÃO:');
      
      // ============================================================
      // AUTO-CONFIRMAR PENDING ITEMS SE EXISTIREM E CARRINHO VAZIO
      // ============================================================
      let currentCartItems = [...cartItems];
      
      const { data: pendingToAutoConfirm } = await supabase
        .from('conversation_pending_items')
        .select(`
          *,
          product:products(id, name, price, category_id)
        `)
        .eq('user_phone', customerPhone)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending');
      
      if (pendingToAutoConfirm && pendingToAutoConfirm.length > 0 && currentCartItems.length === 0) {
        console.log(`[Tool] 🔄 AUTO-CONFIRM: ${pendingToAutoConfirm.length} pending items encontrados com carrinho vazio`);
        console.log(`[Tool] 🔄 Confirmando automaticamente para não perder o pedido...`);
        
        // Create cart if needed
        if (!currentActiveCart) {
          const { data: newCart } = await supabase
            .from('carts')
            .insert({
              restaurant_id: restaurantId,
              user_phone: customerPhone,
              status: 'active'
            })
            .select()
            .single();
          currentActiveCart = newCart;
          stateUpdate.activeCart = newCart;
          console.log(`[Tool] 🔄 Carrinho criado: ${newCart?.id}`);
        }
        
        // Move pending items to cart
        for (const pendingItem of pendingToAutoConfirm) {
          const { data: cartItem } = await supabase
            .from('cart_items')
            .insert({
              cart_id: currentActiveCart!.id,
              product_id: pendingItem.product_id,
              quantity: pendingItem.quantity,
              notes: pendingItem.notes
            })
            .select()
            .single();
          
          // Add addons if any
          if (cartItem && pendingItem.addon_ids && pendingItem.addon_ids.length > 0) {
            const addonInserts = pendingItem.addon_ids.map((addonId: string) => ({
              cart_item_id: cartItem.id,
              addon_id: addonId
            }));
            await supabase.from('cart_item_addons').insert(addonInserts);
          }
          
          // Update currentCartItems for checklist
          const product = pendingItem.product || availableProducts.find(p => p.id === pendingItem.product_id);
          if (product) {
            currentCartItems.push({
              product_id: pendingItem.product_id,
              product_name: product.name,
              quantity: pendingItem.quantity,
              total_price: product.price * pendingItem.quantity
            });
          }
          
          console.log(`[Tool] 🔄 Item movido: ${pendingItem.quantity}x ${product?.name || pendingItem.product_id}`);
        }
        
        // Mark pending items as confirmed
        await supabase
          .from('conversation_pending_items')
          .update({ status: 'confirmed' })
          .eq('user_phone', customerPhone)
          .eq('restaurant_id', restaurantId)
          .eq('status', 'pending');
        
        console.log(`[Tool] ✅ AUTO-CONFIRM: ${pendingToAutoConfirm.length} itens movidos para o carrinho`);
        stateUpdate.cartModified = true;
      } else if (pendingToAutoConfirm && pendingToAutoConfirm.length > 0) {
        console.log(`[Tool] ⚠️ DIAGNOSTIC: ${pendingToAutoConfirm.length} pending items existem mas carrinho já tem ${currentCartItems.length} itens`);
      }
      
      const checklistResults = {
        has_cart: !!currentActiveCart,
        has_items: currentCartItems.length > 0,
        has_address: !!newMetadata.delivery_address,
        has_payment: !!newMetadata.payment_method,
        items_count: currentCartItems.length,
        address: newMetadata.delivery_address || null,
        payment: newMetadata.payment_method || null,
        auto_confirmed_pending: (pendingToAutoConfirm?.length || 0) > 0 && cartItems.length === 0
      };
      
      console.log(`[Tool]   ✓ Carrinho existe: ${checklistResults.has_cart}`);
      console.log(`[Tool]   ✓ Itens no carrinho: ${checklistResults.has_items} (${checklistResults.items_count} itens)`);
      console.log(`[Tool]   ✓ Endereço definido: ${checklistResults.has_address} (${checklistResults.address || 'N/A'})`);
      console.log(`[Tool]   ✓ Pagamento definido: ${checklistResults.has_payment} (${checklistResults.payment || 'N/A'})`);
      if (checklistResults.auto_confirmed_pending) {
        console.log(`[Tool]   ✓ Auto-confirmados: ${pendingToAutoConfirm?.length} itens pendentes`);
      }
      
      // Verificação 1: Carrinho
      if (!currentActiveCart || currentCartItems.length === 0) {
        console.log('[Tool] ❌ FALHA: Carrinho vazio');
        return {
          output: {
            success: false,
            error: 'Carrinho vazio - não é possível finalizar',
            checklist: checklistResults,
            action_required: 'add_items',
            message: 'O carrinho está vazio! O que você gostaria de pedir?'
          }
        };
      }
      
      // Verificação 2: Endereço
      if (!newMetadata.delivery_address) {
        console.log('[Tool] ❌ FALHA: Endereço não definido');
        return {
          output: {
            success: false,
            missing: 'delivery_address',
            checklist: checklistResults,
            action_required: 'collect_address',
            message: 'Pra onde eu mando? Me diz a rua e número.'
          }
        };
      }
      
      // Verificação 3: Pagamento
      if (!newMetadata.payment_method) {
        console.log('[Tool] ❌ FALHA: Método de pagamento não definido');
        return {
          output: {
            success: false,
            missing: 'payment_method',
            checklist: checklistResults,
            action_required: 'collect_payment',
            message: 'Como vai pagar? Dinheiro, cartão ou MBWay?'
          }
        };
      }
      
      console.log('[Tool] ✅ CHECKLIST COMPLETO - Prosseguindo com finalização');
      
      // Calculate total
      const subtotal = currentCartItems.reduce((sum: number, item: any) => sum + item.total_price, 0);
      const deliveryFee = newMetadata.delivery_fee || restaurant.delivery_fee || 0;
      const orderTotal = subtotal + deliveryFee;
      
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId,
          user_phone: customerPhone,
          cart_id: currentActiveCart.id,
          delivery_address: newMetadata.delivery_address,
          payment_method: newMetadata.payment_method,
          total_amount: orderTotal,
          status: 'new'
        })
        .select()
        .single();
      
      if (orderError) {
        console.error('[Tool] Order creation error:', orderError);
        return {
          output: {
            success: false,
            error: 'Erro ao criar pedido'
          }
        };
      }
      
      console.log(`[Tool] ✅ Order created: ${order.id}`);
      
      // Update cart status
      await supabase
        .from('carts')
        .update({ 
          status: 'completed',
          metadata: {
            ...newMetadata,
            delivery_fee: deliveryFee,
            subtotal,
            total: orderTotal
          }
        })
        .eq('id', currentActiveCart.id);
      
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
      
      // Cleanup pending items
      await supabase
        .from('conversation_pending_items')
        .update({ status: 'discarded' })
        .eq('user_phone', customerPhone)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending');
      
      stateUpdate.newMetadata = {};
      stateUpdate.newState = 'idle';
      stateUpdate.activeCart = null;
      stateUpdate.cartModified = true;
      stateUpdate.finalizeSuccess = true;
      
      return {
        output: {
          success: true,
          order_id: order.id,
          total: orderTotal,
          message: `🎉 Pedido confirmado! Total: €${orderTotal.toFixed(2)}. O teu pedido chegará em breve!`
        },
        stateUpdate
      };
    }
    
    case 'update_customer_profile': {
      const { name, default_address, default_payment_method } = args;
      
      const updateData: any = { 
        phone: customerPhone,
        restaurant_id: restaurantId
      };
      if (name !== undefined) updateData.name = name;
      if (default_address !== undefined) {
        updateData.default_address = typeof default_address === 'string' 
          ? { formatted: default_address }
          : default_address;
      }
      if (default_payment_method !== undefined) updateData.default_payment_method = default_payment_method;
      
      const { error: profileError } = await supabase
        .from('customers')
        .upsert(updateData, { onConflict: 'phone,restaurant_id' });
      
      if (profileError) {
        console.error('[Tool] Update customer profile error:', profileError);
        return { output: { success: false, error: profileError.message } };
      }
      
      console.log('[Tool] ✅ Updated customer profile');
      return {
        output: {
          success: true,
          message: 'Perfil atualizado'
        }
      };
    }
    
    case 'get_customer_history': {
      console.log(`[Tool] 📊 Fetching customer history for ${customerPhone}`);
      
      try {
        const insights = await getCustomerInsights(supabase, customerPhone);
        
        if (!insights || insights.order_count === 0) {
          console.log('[Tool] → Customer is new');
          return {
            output: {
              success: true,
              customer_status: 'new',
              message: 'Cliente novo - primeira interação.',
              order_count: 0,
              suggestions: ['Apresentar o cardápio', 'Perguntar preferências']
            }
          };
        }
        
        const topItems = (insights.preferred_items || []).slice(0, 3);
        const topAddons = (insights.preferred_addons || []).slice(0, 3);
        const customerStatus = insights.order_count >= 5 ? 'vip' : 
                               insights.order_count >= 2 ? 'returning' : 'first_return';
        
        const suggestions: string[] = [];
        if (topItems.length > 0) {
          suggestions.push(`Sugerir: "${topItems[0].name}" (favorito)`);
        }
        if (customerStatus === 'vip') {
          suggestions.push('Cliente VIP - tratamento especial!');
        }
        
        console.log(`[Tool] ✅ Found history: ${insights.order_count} orders`);
        
        return {
          output: {
            success: true,
            customer_status: customerStatus,
            order_count: insights.order_count,
            average_ticket: insights.average_ticket ? `€${insights.average_ticket.toFixed(2)}` : null,
            favorite_items: topItems.map((i: any) => `${i.name} (${i.count}x)`),
            favorite_addons: topAddons.map((a: any) => `${a.name} (${a.count}x)`),
            suggestions
          }
        };
      } catch (historyError: any) {
        console.error('[Tool] ❌ Error fetching customer history:', historyError);
        return {
          output: {
            success: false,
            error: 'Erro ao carregar histórico'
          }
        };
      }
    }
    
    case 'add_pending_item': {
      const { product_id, quantity = 1, addon_ids = [], notes } = args;
      
      const product = availableProducts.find(p => p.id === product_id);
      if (!product) {
        return { output: { success: false, error: 'Produto não encontrado' } };
      }
      
      const { error: pendingError } = await supabase
        .from('conversation_pending_items')
        .insert({
          user_phone: customerPhone,
          restaurant_id: restaurantId,
          product_id,
          quantity,
          addon_ids,
          notes,
          status: 'pending'
        });
      
      if (pendingError) {
        return { output: { success: false, error: pendingError.message } };
      }
      
      console.log(`[Tool] ✅ Added pending item: ${product.name}`);
      return {
        output: {
          success: true,
          message: `${product.name} adicionado aos itens pendentes`
        }
      };
    }
    
    case 'confirm_pending_items': {
      const { data: itemsToConfirm } = await supabase
        .from('conversation_pending_items')
        .select('*')
        .eq('user_phone', customerPhone)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending');
      
      if (!itemsToConfirm || itemsToConfirm.length === 0) {
        return { output: { success: false, message: 'Nenhum item pendente para confirmar' } };
      }
      
      // Create cart if needed
      if (!currentActiveCart) {
        const { data: newCart } = await supabase
          .from('carts')
          .insert({
            restaurant_id: restaurantId,
            user_phone: customerPhone,
            status: 'active'
          })
          .select()
          .single();
        currentActiveCart = newCart;
        stateUpdate.activeCart = newCart;
      }
      
      // Move pending items to cart
      let addedCount = 0;
      for (const pendingItem of itemsToConfirm) {
        const { data: cartItem } = await supabase
          .from('cart_items')
          .insert({
            cart_id: currentActiveCart!.id,
            product_id: pendingItem.product_id,
            quantity: pendingItem.quantity,
            notes: pendingItem.notes
          })
          .select()
          .single();
        
        if (cartItem && pendingItem.addon_ids && pendingItem.addon_ids.length > 0) {
          await supabase.from('cart_item_addons').insert(
            pendingItem.addon_ids.map((addonId: string) => ({
              cart_item_id: cartItem.id,
              addon_id: addonId
            }))
          );
        }
        
        await supabase
          .from('conversation_pending_items')
          .update({ status: 'confirmed' })
          .eq('id', pendingItem.id);
        
        addedCount++;
      }
      
      stateUpdate.cartModified = true;
      console.log(`[Tool] ✅ Confirmed ${addedCount} pending items`);
      
      return {
        output: {
          success: true,
          count: addedCount,
          message: `${addedCount} item(s) adicionado(s) ao carrinho`
        },
        stateUpdate
      };
    }
    
    case 'remove_pending_item': {
      const { product_id, quantity = 1 } = args;
      
      await supabase
        .from('conversation_pending_items')
        .update({ status: 'discarded' })
        .eq('user_phone', customerPhone)
        .eq('restaurant_id', restaurantId)
        .eq('product_id', product_id)
        .eq('status', 'pending');
      
      console.log(`[Tool] ✅ Removed pending item`);
      return {
        output: { success: true, message: 'Item pendente removido' }
      };
    }
    
    case 'clear_pending_items': {
      await supabase
        .from('conversation_pending_items')
        .update({ status: 'discarded' })
        .eq('user_phone', customerPhone)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending');
      
      console.log('[Tool] ✅ Cleared all pending items');
      return {
        output: { success: true, message: 'Itens pendentes limpos' }
      };
    }
    
    case 'request_human_handoff': {
      const { reason, summary } = args;
      
      console.log(`[Tool] 🚨 HANDOFF REQUESTED - Reason: ${reason}`);
      console.log(`[Tool] 📝 Summary: ${summary || 'No summary provided'}`);
      
      // 1. Update conversation_mode to 'manual'
      const { error: modeError } = await supabase
        .from('conversation_mode')
        .upsert({
          restaurant_id: restaurantId,
          user_phone: customerPhone,
          mode: 'manual',
          taken_over_at: new Date().toISOString(),
          handoff_reason: reason,
          handoff_summary: summary || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'restaurant_id,user_phone' });
      
      if (modeError) {
        console.error('[Tool] ❌ Failed to set manual mode:', modeError);
        return {
          output: {
            success: false,
            error: 'Erro ao transferir para atendente'
          }
        };
      }
      
      console.log('[Tool] ✅ Conversation mode set to MANUAL');
      
      // 2. Get customer name for notification
      const { data: customerData } = await supabase
        .from('customers')
        .select('name')
        .eq('phone', customerPhone)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      
      const customerName = customerData?.name || customerPhone;
      
      // 3. Create urgent notification entry in system_logs for real-time detection
      const reasonLabels: Record<string, string> = {
        'customer_request': 'Pedido do cliente',
        'aggressive_tone': 'Tom agressivo/frustração',
        'ai_limitation': 'IA não conseguiu resolver',
        'repeated_confusion': 'Confusão repetida'
      };
      
      const { error: logError } = await supabase
        .from('system_logs')
        .insert({
          restaurant_id: restaurantId,
          log_type: 'handoff_requested',
          severity: 'warn',
          message: `🚨 Handoff solicitado: ${customerName}`,
          metadata: {
            customer_phone: customerPhone,
            customer_name: customerName,
            reason,
            reason_label: reasonLabels[reason] || reason,
            summary: summary || null,
            timestamp: new Date().toISOString()
          }
        });
      
      if (logError) {
        console.error('[Tool] ⚠️ Failed to create handoff log:', logError);
      } else {
        console.log('[Tool] ✅ Handoff notification logged');
      }
      
      // Set state to manual_requested
      stateUpdate.newState = 'manual_requested';
      
      return {
        output: {
          success: true,
          reason,
          summary,
          message: 'Conversa transferida para atendente humano'
        },
        stateUpdate
      };
    }
    
    default:
      console.warn(`[Tool] ⚠️ Unknown tool: ${functionName}`);
      return {
        output: { success: false, error: `Unknown tool: ${functionName}` }
      };
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function buildSystemPromptFromBlocks(
  blocks: any[] | null | undefined,
  fallback: string
): string {
  if (!blocks || blocks.length === 0) {
    return fallback;
  }
  
  return blocks.map(block => block.content).join('\n\n');
}

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  'sobremesas': ['doces', 'açaí', 'pizzas doces', 'sobremesa'],
  'sobremesa': ['doces', 'açaí', 'pizzas doces', 'sobremesas'],
  'desserts': ['doces', 'açaí', 'pizzas doces'],
  'dessert': ['doces', 'açaí', 'pizzas doces'],
  'lanches': ['hambúrgueres', 'salgados brasileiros', 'enrolados', 'lanche'],
  'lanche': ['hambúrgueres', 'salgados brasileiros', 'enrolados', 'lanches'],
  'snacks': ['hambúrgueres', 'salgados brasileiros'],
  'drinks': ['bebidas', 'bebida'],
  'bebida': ['bebidas'],
  'pizzas': ['pizzas salgadas', 'pizzas doces', 'pizza'],
  'pizza': ['pizzas salgadas', 'pizzas doces', 'pizzas'],
};

function expandCategorySynonyms(category: string): string[] {
  const lower = category.toLowerCase().trim();
  const synonyms = CATEGORY_SYNONYMS[lower];
  return synonyms ? [lower, ...synonyms] : [lower];
}

function searchProducts(
  products: any[], 
  query: string | undefined, 
  category?: string, 
  maxResults: number = 5
): Array<{ product: any; similarity: number }> {
  const queryLower = (query || '').toLowerCase().trim();
  
  let filtered = products;
  if (category) {
    const categoriesToSearch = expandCategorySynonyms(category);
    console.log(`[Search] Category "${category}" expanded to: ${categoriesToSearch.join(', ')}`);
    
    filtered = products.filter(p => {
      const productCategory = (p.category || '').toLowerCase();
      return categoriesToSearch.some(cat => productCategory.includes(cat) || cat.includes(productCategory));
    });
    
    console.log(`[Search] Found ${filtered.length} products in expanded categories`);
  }
  
  if (category && filtered.length > 0) {
    if (!queryLower) {
      return filtered
        .slice(0, maxResults)
        .map(product => ({ product, similarity: 0.8 }));
    }
    
    const scored = filtered.map(product => {
      let score = 0.5;
      const nameLower = (product.name || '').toLowerCase();
      const descLower = (product.description || '').toLowerCase();
      
      if (nameLower.includes(queryLower)) {
        score = 0.9;
      } else if (descLower.includes(queryLower)) {
        score = 0.7;
      } else {
        const queryWords = queryLower.split(/\s+/).filter(Boolean);
        const nameWords = nameLower.split(/\s+/).filter(Boolean);
        const matchingWords = queryWords.filter((qw: string) => 
          nameWords.some((nw: string) => nw.includes(qw) || qw.includes(nw))
        ).length;
        
        if (matchingWords > 0) {
          score = 0.6;
        }
      }
      
      return { product, similarity: score };
    });
    
    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
  }
  
  if (!queryLower && !category) {
    return filtered
      .slice(0, maxResults)
      .map(product => ({ product, similarity: 0.5 }));
  }
  
  const scored = filtered.map(product => {
    let score = 0;
    const nameLower = (product.name || '').toLowerCase();
    const descLower = (product.description || '').toLowerCase();
    
    if (nameLower === queryLower) {
      score = 1.0;
    }
    else if (nameLower.includes(queryLower)) {
      score = 0.8;
    }
    else if (descLower.includes(queryLower)) {
      score = 0.6;
    }
    else {
      const distance = levenshteinDistance(queryLower, nameLower);
      const maxLen = Math.max(queryLower.length, nameLower.length);
      score = maxLen > 0 ? 1 - (distance / maxLen) : 0;
    }
    
    const queryWords = queryLower.split(/\s+/).filter(Boolean);
    const nameWords = nameLower.split(/\s+/).filter(Boolean);
    const matchingWords = queryWords.filter((qw: string) => 
      nameWords.some((nw: string) => nw.includes(qw) || qw.includes(nw))
    ).length;
    
    if (matchingWords > 0 && score < 0.5) {
      score = Math.max(score, 0.3 + (matchingWords / queryWords.length) * 0.4);
    }
    
    return { product, similarity: score };
  });
  
  return scored
    .filter(s => s.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}

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
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  return matrix[b.length][a.length];
}

function applyTemplateVariables(prompt: string, variables: Record<string, string>): string {
  let result = prompt;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replaceAll(placeholder, value);
  }
  
  return result;
}

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

function buildBehaviorConfigSection(behaviorConfig: any): string {
  let section = '\n\n# BEHAVIOR CONFIGURATION (FROM DATABASE)\n\n';
  let configCount = 0;
  
  if (behaviorConfig.customer_profile) {
    const cp = behaviorConfig.customer_profile;
    section += '## Customer Profile Behavior\n\n';
    section += 'Guidelines for managing customer profile data:\n\n';
    section += `- **Auto-load profile**: ${cp.auto_load ? 'YES' : 'NO'}\n`;
    section += `- **Update name from conversation**: ${cp.update_name_from_conversation ? 'YES' : 'NO'}\n`;
    section += `- **Update address on confirmation**: ${cp.update_address_on_confirmation ? 'YES' : 'NO'}\n`;
    section += `- **Update payment on confirmation**: ${cp.update_payment_on_confirmation ? 'YES' : 'NO'}\n\n`;
    configCount++;
  }
  
  if (behaviorConfig.pending_products) {
    const pp = behaviorConfig.pending_products;
    section += '## Pending Products Behavior\n\n';
    section += `- **Multiple pending items**: ${pp.allow_multiple ? 'YES' : 'NO'}\n`;
    section += `- **Expiration time**: ${pp.expiration_minutes || 15} minutes\n\n`;
    configCount++;
  }
  
  if (configCount > 0) {
    console.log(`[Behavior Config] Injected ${configCount} behavior sections into prompt`);
  }
  
  return section;
}
