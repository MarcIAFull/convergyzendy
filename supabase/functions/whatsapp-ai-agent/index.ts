import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getStatePrompt, type OrderState } from "./state-prompts.ts";
import { updateCustomerInsightsAfterOrder, getCustomerInsights } from "../_shared/customerInsights.ts";

/**
 * WhatsApp AI Ordering Agent
 * 
 * CRITICAL CART RETRIEVAL LOGIC:
 * ================================
 * This agent uses THREE helper functions for cart management:
 * 
 * 1. getActiveCartWithItems(supabase, restaurantId, phone)
 *    - Returns ONLY carts with status='active'
 *    - Returns NULL if no active cart exists (does NOT create)
 *    - NEVER returns completed/cancelled/abandoned carts
 *    - If multiple active carts exist, abandons all but the most recent
 * 
 * 2. createNewCart(supabase, restaurantId, phone)
 *    - Creates a fresh cart with status='active' and no items
 * 
 * 3. getOrCreateActiveCart(supabase, restaurantId, phone)
 *    - Combines the above: gets existing active cart or creates new one
 *    - Used at conversation start to ensure there's always a cart
 * 
 * The AI MUST:
 * - Trust getActiveCartWithItems as the single source of truth for current cart
 * - Never assume cart contents from old messages or timestamps
 * - Never reference completed orders as if they're in the current cart
 * - Distinguish between "current order" (active cart) and "last order" (completed historical data)
 * 
 * This ensures the AI never shows old completed carts to the user.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  notes?: string;
  addons: Array<{ addon_id: string; name: string; price: number }>;
}

interface SessionState {
  current_state: OrderState;
  has_open_cart: boolean;
  cart_item_count: number;
  cart_total: number;
  last_user_message: string | null;
  last_agent_message: string | null;
  last_order?: {
    id: string;
    status: string;
    confirmed_at: string;
    total: number;
  };
}

interface CustomerProfile {
  preferred_items: Array<{ id: string; name: string; count: number }>;
  preferred_addons: Array<{ id: string; name: string; count: number }>;
  rejected_items: Array<{ id: string; name: string; count: number }>;
  average_ticket: number | null;
  order_count: number;
  order_frequency_days: number | null;
  notes: string | null;
}

interface ConversationState {
  cart: CartItem[];
  delivery_address?: string;
  payment_method?: string;
  state: OrderState;
  pending_item?: {
    product_id: string;
    quantity: number;
    addon_ids?: string[];
  };
}

// State machine transitions
const STATE_TRANSITIONS: Record<OrderState, OrderState[]> = {
  idle: ['browsing_menu'],
  browsing_menu: ['adding_item', 'collecting_address'],
  adding_item: ['choosing_addons', 'confirming_item'],
  choosing_addons: ['confirming_item'],
  confirming_item: ['browsing_menu', 'collecting_address'],
  collecting_address: ['collecting_payment'],
  collecting_payment: ['confirming_order'],
  confirming_order: ['order_completed', 'browsing_menu'],
  order_completed: ['idle'],
};

function canTransition(from: OrderState, to: OrderState): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get or create conversation state from database.
 * Ensures exactly ONE active conversation state per (restaurant_id, user_phone).
 * If multiple exist (edge case), keeps the most recent.
 */
async function getOrCreateConversationState(
  supabase: any,
  restaurantId: string,
  customerPhone: string,
  cartId: string | null
): Promise<{ id: string; state: OrderState; cart_id: string | null }> {
  console.log('[ConversationState] Loading state for:', customerPhone);

  // Fetch all states for this user (should be 0 or 1, but handle edge cases)
  const { data: states, error: fetchError } = await supabase
    .from('conversation_state')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('user_phone', customerPhone)
    .order('updated_at', { ascending: false });

  if (fetchError) {
    console.error('[ConversationState] Error fetching state:', fetchError);
    throw fetchError;
  }

  // If multiple states exist (shouldn't happen due to UNIQUE constraint), clean up
  if (states && states.length > 1) {
    console.warn(`[ConversationState] ⚠️ Multiple states found (${states.length}), keeping most recent`);
    const stateToKeep = states[0];
    const statesToDelete = states.slice(1).map((s: any) => s.id);

    const { error: deleteError } = await supabase
      .from('conversation_state')
      .delete()
      .in('id', statesToDelete);

    if (deleteError) {
      console.error('[ConversationState] Error cleaning up duplicate states:', deleteError);
    }

    console.log(`[ConversationState] ✅ Loaded existing state: ${stateToKeep.state} (cart: ${stateToKeep.cart_id || 'none'})`);
    return stateToKeep;
  }

  // If exactly one state exists, return it
  if (states && states.length === 1) {
    console.log(`[ConversationState] ✅ Loaded existing state: ${states[0].state} (cart: ${states[0].cart_id || 'none'})`);
    return states[0];
  }

  // No state exists, create one
  console.log('[ConversationState] Creating new state (idle)');
  const { data: newState, error: createError } = await supabase
    .from('conversation_state')
    .insert({
      restaurant_id: restaurantId,
      user_phone: customerPhone,
      state: 'idle',
      cart_id: cartId,
    })
    .select()
    .single();

  if (createError) {
    console.error('[ConversationState] Error creating state:', createError);
    throw createError;
  }

  console.log(`[ConversationState] ✅ Created new state: idle`);
  return newState;
}

/**
 * Update conversation state in database.
 * This is the SINGLE SOURCE OF TRUTH for the current state.
 */
async function updateConversationState(
  supabase: any,
  stateId: string,
  newState: OrderState,
  cartId: string | null
) {
  console.log(`[ConversationState] Updating state: ${newState} (cart: ${cartId || 'none'})`);

  const { error } = await supabase
    .from('conversation_state')
    .update({
      state: newState,
      cart_id: cartId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', stateId);

  if (error) {
    console.error('[ConversationState] Error updating state:', error);
    throw error;
  }

  console.log(`[ConversationState] ✅ State updated to: ${newState}`);
}

/**
 * Determine next state based on tool execution.
 * SERVER-SIDE deterministic state transitions.
 */
function determineNextState(
  currentState: OrderState,
  toolName: string,
  hasCartItems: boolean,
  hasAddress: boolean,
  hasPayment: boolean
): OrderState {
  console.log(`[StateMachine] Determining next state from ${currentState} after tool: ${toolName}`);
  console.log(`[StateMachine] Context: hasCartItems=${hasCartItems}, hasAddress=${hasAddress}, hasPayment=${hasPayment}`);

  switch (toolName) {
    case 'add_to_cart':
      // After adding item, go to confirming or browsing
      return hasCartItems ? 'confirming_item' : 'adding_item';

    case 'remove_from_cart':
    case 'update_cart_item':
      // After modifying cart, stay in browsing if items remain
      return hasCartItems ? 'confirming_item' : 'browsing_menu';

    case 'set_delivery_address':
      // After address, collect payment
      return 'collecting_payment';

    case 'set_payment_method':
      // After payment, confirm order
      return 'confirming_order';

    case 'finalize_order':
      // Order completed
      return 'order_completed';

    case 'cancel_order':
      // Back to idle
      return 'idle';

    case 'transition_state':
      // LLM explicitly requested state change (allow but log)
      console.log('[StateMachine] ⚠️ LLM requested explicit state transition');
      return currentState; // Don't change here, handled separately

    default:
      // No state change for other tools
      return currentState;
  }
}

/**
 * CART RETRIEVAL HELPERS
 * ======================
 * These functions enforce strict cart status filtering to prevent mixing
 * active carts with completed/cancelled/abandoned ones.
 */

/**
 * Get the active cart with all items loaded.
 * Returns NULL if no active cart exists (does NOT create one).
 * Only returns carts with status='active'.
 * 
 * If multiple active carts exist (edge case), abandons all but the most recent.
 */
async function getActiveCartWithItems(supabase: any, restaurantId: string, customerPhone: string) {
  console.log('[Cart] Getting active cart for:', customerPhone);
  
  // Fetch ALL active carts (not using maybeSingle to catch edge cases)
  const { data: activeCarts, error: fetchError } = await supabase
    .from('carts')
    .select(`
      id,
      status,
      updated_at,
      created_at,
      cart_items (
        id,
        product_id,
        quantity,
        notes,
        products (
          id,
          name,
          price
        ),
        cart_item_addons (
          addon_id,
          addons (
            id,
            name,
            price
          )
        )
      )
    `)
    .eq('user_phone', customerPhone)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (fetchError) {
    console.error('[Cart] Error fetching active carts:', fetchError);
    throw fetchError;
  }

  const count = activeCarts?.length || 0;
  console.log(`[Cart] Found ${count} active cart(s)`);

  // If no active carts, return null
  if (!activeCarts || activeCarts.length === 0) {
    console.log('[Cart] No active cart exists');
    return null;
  }

  // If multiple active carts exist (edge case), clean up
  if (activeCarts.length > 1) {
    console.warn(`[Cart] ⚠️ Multiple active carts detected (${activeCarts.length}), cleaning up...`);
    
    // Keep the most recent one, abandon the rest
    const cartsToAbandon = activeCarts.slice(1).map((c: any) => c.id);
    
    const { error: abandonError } = await supabase
      .from('carts')
      .update({ status: 'abandoned' })
      .in('id', cartsToAbandon);
    
    if (abandonError) {
      console.error('[Cart] Error abandoning old carts:', abandonError);
    } else {
      console.log(`[Cart] ✅ Abandoned ${cartsToAbandon.length} old cart(s)`);
    }
  }

  const activeCart = activeCarts[0];
  console.log(`[Cart] Returning active cart ${activeCart.id} with ${activeCart.cart_items?.length || 0} items`);
  return activeCart;
}

/**
 * Create a new active cart for the customer.
 * Always creates a fresh cart with status='active' and no items.
 */
async function createNewCart(supabase: any, restaurantId: string, customerPhone: string) {
  console.log('[Cart] Creating new cart for:', customerPhone);
  
  const { data: newCart, error: createError } = await supabase
    .from('carts')
    .insert({
      restaurant_id: restaurantId,
      user_phone: customerPhone,
      status: 'active',
    })
    .select(`
      id,
      status,
      created_at,
      updated_at,
      cart_items (
        id,
        product_id,
        quantity,
        notes,
        products (
          id,
          name,
          price
        ),
        cart_item_addons (
          addon_id,
          addons (
            id,
            name,
            price
          )
        )
      )
    `)
    .single();

  if (createError) {
    console.error('[Cart] Error creating new cart:', createError);
    throw createError;
  }

  console.log(`[Cart] ✅ Created new cart: ${newCart.id}`);
  return newCart;
}

/**
 * Get or create an active cart.
 * First checks for existing active cart, creates if none exists.
 * Used at the start of conversation to ensure there's always a cart to work with.
 */
async function getOrCreateActiveCart(supabase: any, restaurantId: string, customerPhone: string) {
  const existingCart = await getActiveCartWithItems(supabase, restaurantId, customerPhone);
  
  if (existingCart) {
    return existingCart;
  }
  
  return await createNewCart(supabase, restaurantId, customerPhone);
}

// Helper function to get the last completed order for a phone number
async function getLastCompletedOrderForPhone(supabase: any, phone: string, restaurantId: string) {
  console.log(`[LastOrder] Fetching last completed order for phone: ${phone}`);
  
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      created_at,
      total_amount,
      delivery_address,
      payment_method,
      cart_id,
      carts!inner (
        cart_items (
          id,
          quantity,
          notes,
          products (
            id,
            name,
            price
          ),
          cart_item_addons (
            addon_id,
            addons (
              id,
              name,
              price
            )
          )
        )
      )
    `)
    .eq('user_phone', phone)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[LastOrder] Error fetching last order:', error);
    return null;
  }

  if (!order) {
    console.log('[LastOrder] No completed orders found');
    return null;
  }

  // Transform the data into a readable format
  const items = order.carts.cart_items.map((item: any) => ({
    product_name: item.products.name,
    quantity: item.quantity,
    price: item.products.price,
    notes: item.notes,
    addons: item.cart_item_addons.map((cia: any) => ({
      name: cia.addons.name,
      price: cia.addons.price,
    })),
  }));

  console.log(`[LastOrder] Found order ${order.id} with ${items.length} items`);

  return {
    id: order.id,
    created_at: order.created_at,
    total: order.total_amount,
    delivery_address: order.delivery_address,
    payment_method: order.payment_method,
    items,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { restaurantId, customerPhone, messageBody } = await req.json();

    console.log(`Processing message from ${customerPhone}: ${messageBody}`);

    // Load restaurant and menu
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }

    // Load menu structure
    const { data: categories } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        products (
          id,
          name,
          description,
          price,
          is_available,
          addons (
            id,
            name,
            price
          )
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('sort_order');

    // Extract product context for AI (with explicit product_id references)
    const availableProducts = categories?.flatMap(cat => 
      cat.products?.filter((p: any) => p.is_available).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: cat.name,
        has_addons: (p.addons?.length || 0) > 0
      })) || []
    ) || [];
    
    console.log(`[Product Context] Loaded ${availableProducts.length} available products for AI reference`);

    // Load conversation history (last 15 messages for session state)
    const { data: messageHistory } = await supabase
      .from('messages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${customerPhone},to_number.eq.${customerPhone}`)
      .order('timestamp', { ascending: true })
      .limit(15);

    // Load active cart (does NOT auto-create)
    // CRITICAL: Only returns carts with status='active', returns NULL if none exists
    let cart = await getActiveCartWithItems(supabase, restaurantId, customerPhone);
    
    if (cart) {
      console.log(`[AI-Agent] Found active cart ${cart.id} with ${cart.cart_items?.length || 0} items`);
    } else {
      console.log(`[AI-Agent] No active cart exists for ${customerPhone}`);
    }

    // Load or create conversation state from database
    // This is the SINGLE SOURCE OF TRUTH for the current state
    const conversationStateRecord = await getOrCreateConversationState(
      supabase,
      restaurantId,
      customerPhone,
      cart?.id || null
    );

    let currentState: OrderState = conversationStateRecord.state as OrderState;
    console.log(`[StateMachine] Current state from DB: ${currentState}`);

    // Load recent order for session state
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('id, status, total_amount, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('user_phone', customerPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Load customer insights for personalization
    const { data: customerInsights } = await supabase
      .from('customer_insights')
      .select('*')
      .eq('phone', customerPhone)
      .maybeSingle();

    // Build customer profile from insights or use defaults
    // CRITICAL: This is HISTORICAL data for suggestions only, NOT the current cart
    const historicalPreferences = customerInsights ? {
      preferred_items: customerInsights.preferred_items || [],
      preferred_addons: customerInsights.preferred_addons || [],
      rejected_items: customerInsights.rejected_items || [],
      average_ticket: customerInsights.average_ticket,
      order_count: customerInsights.order_count,
      order_frequency_days: customerInsights.order_frequency_days,
      notes: customerInsights.notes,
    } : {
      preferred_items: [],
      preferred_addons: [],
      rejected_items: [],
      average_ticket: null,
      order_count: 0,
      order_frequency_days: null,
      notes: null,
    };

    console.log('[AI-Agent] Loaded customer insights (HISTORICAL ONLY):', JSON.stringify({
      phone: customerPhone,
      order_count: historicalPreferences.order_count,
      preferred_items_count: historicalPreferences.preferred_items.length,
      has_notes: !!historicalPreferences.notes,
    }));

    // CRITICAL: Build current cart items - ONLY from active cart, NEVER from history
    const currentCartItems: CartItem[] = cart?.cart_items?.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.products.name,
      quantity: item.quantity,
      price: item.products.price,
      notes: item.notes,
      addons: item.cart_item_addons?.map((cia: any) => ({
        addon_id: cia.addon_id,
        name: cia.addons.name,
        price: cia.addons.price,
      })) || [],
    })) || [];

    const cartTotal = currentCartItems.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const addonsTotal = item.addons.reduce((aSum, addon) => aSum + addon.price, 0) * item.quantity;
      return sum + itemTotal + addonsTotal;
    }, 0);

    // Log current cart state clearly
    console.log(`[AI-Agent] ========== CART STATE AT START OF TURN ==========`);
    console.log(`[AI-Agent] Conversation state: ${currentState}`);
    if (cart) {
      console.log(`[AI-Agent] ✅ Active cart exists: ${cart.id}`);
      console.log(`[AI-Agent] Cart items count: ${currentCartItems.length}`);
      if (currentCartItems.length > 0) {
        console.log('[AI-Agent] Current cart contents:', currentCartItems.map(i => `${i.quantity}x ${i.product_name}`).join(', '));
      } else {
        console.log('[AI-Agent] ⚠️ Cart exists but is EMPTY (no items added yet)');
      }
      console.log(`[AI-Agent] Cart total: €${cartTotal.toFixed(2)}`);
    } else {
      console.log(`[AI-Agent] ❌ No active cart exists for ${customerPhone}`);
      console.log(`[AI-Agent] Current cart items: [] (empty array)`);
    }
    console.log(`[AI-Agent] =====================================================`);

    // Extract last messages for session state
    const lastUserMessage = messageHistory?.filter((m: any) => m.direction === 'inbound').slice(-1)[0]?.body || null;
    const lastAgentMessage = messageHistory?.filter((m: any) => m.direction === 'outbound').slice(-1)[0]?.body || null;

    // Build structured session state using DB-backed state
    const hasOpenCart = cart !== null && currentCartItems.length > 0;

    const sessionState: SessionState = {
      current_state: currentState,
      has_open_cart: hasOpenCart,
      cart_item_count: currentCartItems.length,
      cart_total: cartTotal,
      last_user_message: lastUserMessage,
      last_agent_message: lastAgentMessage,
      ...(lastOrder && {
        last_order: {
          id: lastOrder.id,
          status: lastOrder.status,
          confirmed_at: lastOrder.created_at,
          total: lastOrder.total_amount,
        },
      }),
    };

    console.log('[SessionState] Built session state:', JSON.stringify(sessionState, null, 2));

    const conversationState: ConversationState = {
      cart: currentCartItems,
      state: currentState,
    };

    console.log('Current State:', currentState);
    console.log('Cart Total:', cartTotal);

    // Build comprehensive system prompt with session state and customer profile
    const systemPrompt = `
====================================================================
🔒 DEVELOPER MESSAGE (HIGHEST PRIORITY)
====================================================================

The assistant must obey the System Message strictly.
The assistant must ALWAYS prefer tool calls over text when user intent involves the cart, address, payment, or order finalization.

The assistant must NEVER call tools with invented product_id, address, or payment_method.

All reasoning steps MUST remain hidden.

====================================================================

You are Convergy, a WhatsApp Ordering Agent for ${restaurant.name}.
Your mission is to guide the user through the ordering flow with clarity, accuracy, and perfect state management.

You ALWAYS behave as follows:
- Friendly, concise, and natural.
- Never hallucinate products, states, or cart data.
- Always respect the backend state and the tool outputs.
- Always think BEFORE responding (chain-of-thought hidden).
- Always follow the Ordering State Machine described below.

Your job is NOT to make decisions.  
Your job is to correctly interpret user intent and call the appropriate tools.

====================================================================
### 1. ORDER STATES (STATE MACHINE)
====================================================================
You must operate strictly inside these states:

idle  
browsing_menu  
confirming_item  
collecting_address  
collecting_payment  
reviewing_order  
ready_to_finalize  
order_complete

Never invent a state.  
Never jump states randomly.

The backend tools define state transitions.  
After ANY tool call, you MUST realign your behavior with the NEW state the backend returns.

Current State: ${currentState}

====================================================================
### 2. GLOBAL RULES
====================================================================

1. **NEVER call a tool unless required by user intent.**
2. **NEVER ignore user confirmation.**
3. **NEVER repeat questions already answered.**
4. **NEVER assume product_id — ALWAYS use IDs provided by the backend tools/menu.**
5. **NEVER show raw tool call code to the user.**
6. **After each tool call, ALWAYS:**
   - wait for tool result
   - update your reasoning with the returned cart/address/payment/state
   - then reply to the user

====================================================================
### 3. CURRENT CART STATE (CRITICAL)
====================================================================

**ABSOLUTE RULE: current_cart_items is the ONLY source of truth for the current order.**

current_cart_items = ${JSON.stringify(currentCartItems)}

${currentCartItems.length === 0 ? '⚠️ THE CART IS EMPTY. You MUST NOT claim any items are in the current order.' : `✅ Current cart has ${currentCartItems.length} item(s).`}

If current_cart_items is empty ([]), you MUST:
- Say "Ainda não tens nenhum item no teu pedido" if asked about the cart
- NEVER mention any item as being "in the cart" or "in the order"
- You can suggest items based on history, but make it clear they are suggestions, not current order items

Historical preferences (preferred_items, preferred_addons) are ONLY for suggestions.
They NEVER represent the current order unless explicitly added to current_cart_items via the add_to_cart tool.

Cart Total: €${cartTotal.toFixed(2)}
Delivery Fee: €${restaurant.delivery_fee}

====================================================================
### 4. INTENT ENGINE (CORE LOGIC)
====================================================================

You must detect user intent intelligently, not by keywords.  
Use semantic understanding.

### INTENT → ACTION Mapping

--------------------------------------------------------------------
#### **A) User wants to see the menu**
Triggers when user expresses desire to browse options.
Examples:
- "menu", "cardápio", "what do you have?", "quero ver opções"
→ ACTION: No tool. Simply show the menu from the available categories.  
→ STATE remains: browsing_menu

Available Menu:
${categories?.map((cat: any) => `
**${cat.name}**
${cat.products?.map((p: any) => `- ${p.name}: €${p.price}${p.description ? ` - ${p.description}` : ''}`).join('\n')}
`).join('\n')}

====================================================================
### PRODUCT REFERENCE TABLE (FOR TOOL CALLS)
====================================================================

When calling add_to_cart, you MUST use these EXACT product_id values:

${availableProducts.slice(0, 30).map(p => 
  `• ${p.name} (${p.category}): product_id = "${p.id}" | €${p.price}${p.has_addons ? ' | HAS ADDONS' : ''}`
).join('\n')}

${availableProducts.length > 30 ? `\n... and ${availableProducts.length - 30} more products` : ''}

**CRITICAL:** Never invent or guess product_id. Always use the exact UUID from this table.

--------------------------------------------------------------------
#### **B) User selects a product**
User shows interest in a specific item, or responds with acceptance.

**Semantic Intent Recognition (NOT keyword matching):**
You must understand the USER'S INTENT, not match exact phrases.

**Few-Shot Examples:**

Example 1:
User: "quero uma pizza"
You describe: "Temos a Margherita por €9.98..."
User: "pode adicionar"
→ INTENT: User is confirming the pizza they just asked about
→ ACTION: Call add_to_cart with product_id for Margherita

Example 2:
User: "me dá um brigadeiro"
→ INTENT: Direct product request
→ ACTION: Call add_to_cart with product_id for Brigadeiro

Example 3:
User: "essa mesmo"
(Said after you mentioned a product)
→ INTENT: Confirmation of previously discussed product
→ ACTION: Call add_to_cart with the product_id you just referenced

Example 4:
User: "ok, coloca essa no pedido"
→ INTENT: Confirmation to add item
→ ACTION: Call add_to_cart

Example 5:
User: "sim, quero"
(After discussing a specific product)
→ INTENT: Affirmative response = confirmation
→ ACTION: Call add_to_cart with the contextual product

**Recognition Signals:**
- Affirmative responses after product discussion: "sim", "ok", "pode ser", "é essa"
- Direct requests: "quero X", "adiciona X", "me dá X"
- Implicit confirmations: "essa", "essa mesmo", "perfeito"
- Action verbs: "coloca", "põe", "adiciona", "pode adicionar"

→ ACTION:
1. Identify EXACT product from conversation context or explicit request.
2. Call **add_to_cart** with:
   - product_id
   - quantity = 1
3. WAIT for tool result.
4. Then confirm to the user.

→ NEW STATE: confirming_item (backend confirms)

If product is ambiguous:
→ ask "Which item exactly?" (NO tool call)

--------------------------------------------------------------------
#### **C) User modifies the cart**
Examples:
- "remove X"
- "tira a água"
- "quero 2 pizzas agora"

→ ACTION:
Use **remove_from_cart** or **add_to_cart** with correct product_id.

--------------------------------------------------------------------
#### **D) User provides address**
Whenever user provides something that resembles an address:
- Street, number, zone, code, place name

→ ACTION:
Call **set_delivery_address** with the raw address text.

--------------------------------------------------------------------
#### **E) User chooses payment**
Any payment preference should trigger the payment tool.

Examples:
- "cartão", "mbway", "dinheiro", "credit card", "paypal"
→ ACTION:
Call **set_payment_method**

--------------------------------------------------------------------
#### **F) User asks to finalize or confirms final review**
Triggers:
- "finalizar"
- "confirmar"
- "pode fechar"
- "está tudo certo"

Only call **finalize_order** if:
- cart has items
- address is set
- payment is set
- state is ready_to_finalize

If something is missing:
→ Tell the user what is missing and continue.

====================================================================
### 5. PRODUCT RESOLUTION (CRITICAL)
====================================================================

You must ALWAYS resolve product selection using one of the following:

1. The product explicitly named by the user.
2. The product in the last assistant message describing a single item.
3. If multiple possible products exist:
   → ask the user to clarify.

NEVER:
- Invent a product
- Default to the first product (e.g., water)
- Add unrelated items

====================================================================
### 6. MEMORY OF PRODUCT CONTEXT
====================================================================

When you show or describe a product to the user,  
you MUST remember:

- product.name  
- product.id  
- product.price  

This internal memory is ONLY for the next user confirmation.  
Never assume it persists across unrelated messages.

If user says "pode ser" right after a product description:
→ Use the last described product.

If unclear:
→ Ask for clarification.

====================================================================
### 7. TOOL CALLING RULES
====================================================================

### **add_to_cart**
Call when:
- User confirms they want an item.
- User increases quantity.
- User clearly expresses desire to add.

Do NOT ask "tens a certeza?"  
They already confirmed.

### **remove_from_cart**
Call when user explicitly wants to remove an item.

### **set_delivery_address**
Call as soon as message clearly contains an address.

### **set_payment_method**
Call as soon as payment preference is clear.

### **finalize_order**
Only call if:
- cart has items
- address is set
- payment is set
- user explicitly asks

### **transition_state**
Use ONLY if the backend instructs or if forced by error recovery.

====================================================================
### 8. CUSTOMER INSIGHTS (OPTIONAL CONTEXT)
====================================================================

Historical Preferences (for suggestions only):
${JSON.stringify(historicalPreferences, null, 2)}

Use these ONLY to:
- Make personalized suggestions
- Offer upsells based on past behavior
- Provide a better user experience

NEVER use historical data to populate current_cart_items.

====================================================================
### 9. ERROR RECOVERY (IMPORTANT)
====================================================================

If the user message does NOT align with the current state:
- Do NOT panic
- Do NOT regress to previous states
- Politely redirect to what is missing

Example:
User tries to finalize but no address:
→ "We still need your delivery address to continue. What is it?"

Example:
User tries to set payment before product is added:
→ "Let's add an item first. What would you like to order?"

====================================================================
### 10. STYLE RULES
====================================================================

- Be friendly, simple, and natural.
- One or two short paragraphs, max.
- Use emojis lightly and naturally.
- NEVER show technical details.
- NEVER show tool names.
- Speak ONLY in European Portuguese.

====================================================================
### 11. SESSION STATE
====================================================================

${JSON.stringify(sessionState, null, 2)}

====================================================================
### END OF SYSTEM MESSAGE
====================================================================

You are the restaurant's official WhatsApp AI ordering assistant.
Execute your role with clarity, efficiency, and friendliness.
`;

    // Build conversation history for OpenAI (reduced to last 5 messages)
    const recentMessages = messageHistory?.slice(-5) || [];
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(recentMessages.map((msg: any) => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.body,
      })) || []),
      { role: 'user', content: messageBody },
    ];

    // Define tools for OpenAI
    const tools = [
      {
        type: 'function',
        function: {
          name: 'add_to_cart',
          description: 'Add a product to the customer cart',
          parameters: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'Product ID from menu' },
              quantity: { type: 'integer', description: 'Quantity to add', default: 1 },
              addon_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional addon IDs',
              },
              notes: { type: 'string', description: 'Optional notes' },
            },
            required: ['product_id', 'quantity'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'remove_from_cart',
          description: 'Remove a product from the cart',
          parameters: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'Product ID to remove' },
            },
            required: ['product_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_cart_item',
          description: 'Update quantity of an item in cart',
          parameters: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'Product ID to update' },
              quantity: { type: 'integer', description: 'New quantity' },
            },
            required: ['product_id', 'quantity'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'set_delivery_address',
          description: 'Set the delivery address',
          parameters: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Delivery address' },
            },
            required: ['address'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'set_payment_method',
          description: 'Set the payment method',
          parameters: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: ['cash', 'card', 'mbway'],
                description: 'Payment method',
              },
            },
            required: ['method'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'cancel_order',
          description: 'Cancel the current order and cart',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_customer_insights',
          description: 'Retrieve fresh customer insights including order history and preferences',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_last_completed_order',
          description: 'Retrieve the customer\'s last completed order with items and addons',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'finalize_order',
          description: 'Create the final order',
          parameters: {
            type: 'object',
            properties: {
              confirmed: { type: 'boolean', description: 'Customer confirmed order' },
            },
            required: ['confirmed'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'transition_state',
          description: 'Move to next state in order flow',
          parameters: {
            type: 'object',
            properties: {
              next_state: {
                type: 'string',
                enum: [
                  'idle',
                  'browsing_menu',
                  'adding_item',
                  'choosing_addons',
                  'confirming_item',
                  'collecting_address',
                  'collecting_payment',
                  'confirming_order',
                  'order_completed',
                ],
                description: 'Next state',
              },
            },
            required: ['next_state'],
          },
        },
      },
    ];

    // Determine if we should force tool consideration based on state
    // States that typically require tools: browsing_menu (add_to_cart), confirming_item (modify/remove),
    // collecting_address (set_delivery_address), collecting_payment (set_payment_method)
    const statesRequiringTools: OrderState[] = [
      'browsing_menu',
      'confirming_item', 
      'collecting_address',
      'collecting_payment'
    ];
    
    const shouldForceToolConsideration = statesRequiringTools.includes(currentState);
    
    console.log(`[OpenAI Call] Current state: ${currentState}`);
    console.log(`[OpenAI Call] User message: "${messageBody}"`);
    console.log(`[OpenAI Call] Force tool consideration: ${shouldForceToolConsideration}`);

    // Call OpenAI with state-driven tool_choice
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        tools,
        temperature: 0.2, // Lower temperature for more deterministic behavior
        ...(shouldForceToolConsideration && { tool_choice: 'auto' }), // Force AI to consider tools when in key states
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const aiData = await openaiResponse.json();
    const aiMessage = aiData.choices[0].message;

    console.log('[AI-Agent] ========== AI RESPONSE ==========');
    console.log('[AI-Agent] User message:', messageBody);
    console.log('[AI-Agent] Current state:', currentState);
    console.log('[AI-Agent] Tool choice forced:', shouldForceToolConsideration);
    console.log('[AI-Agent] Response text:', aiMessage.content);
    console.log('[AI-Agent] Tool calls:', aiMessage.tool_calls ? `${aiMessage.tool_calls.length} tool(s)` : 'none');
    if (aiMessage.tool_calls) {
      aiMessage.tool_calls.forEach((tc: any) => {
        console.log(`[AI-Agent]   ✅ ${tc.function.name}:`, tc.function.arguments);
      });
    } else {
      console.log('[AI-Agent]   ❌ NO TOOL CALLS - AI responded with text only');
      if (shouldForceToolConsideration) {
        console.log('[AI-Agent]   ⚠️  WARNING: Expected tool call in state:', currentState);
      }
    }
    console.log('[AI-Agent] =======================================');

    // Process tool calls
    let newState: OrderState = currentState;
    let deliveryAddress = conversationState.delivery_address;
    let paymentMethod = conversationState.payment_method;
    const toolResults: any[] = [];

    if (aiMessage.tool_calls) {
      for (const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`Executing tool: ${functionName}`, args);

        try {
          switch (functionName) {
            case 'add_to_cart': {
              console.log('[add_to_cart] ========== ADDING ITEM TO CART ==========');
              console.log('[add_to_cart] Product ID:', args.product_id);
              console.log('[add_to_cart] Quantity:', args.quantity);
              console.log('[add_to_cart] Addon IDs:', args.addon_ids);
              console.log('[add_to_cart] Notes:', args.notes);
              
              // Ensure cart exists before adding items
              if (!cart) {
                console.log('[add_to_cart] No active cart exists - creating new cart');
                cart = await createNewCart(supabase, restaurantId, customerPhone);
                console.log('[add_to_cart] ✅ Created new cart:', cart.id);
              } else {
                console.log('[add_to_cart] Using existing cart:', cart.id);
              }

              // Validate product exists
              const { data: product, error: productError } = await supabase
                .from('products')
                .select('id, name, price')
                .eq('id', args.product_id)
                .single();

              if (productError || !product) {
                console.error('[add_to_cart] ❌ Product not found:', args.product_id, productError);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'Product not found' }),
                });
                break;
              }
              
              console.log('[add_to_cart] ✅ Product found:', product.name, '€' + product.price);

              // Find or create cart item for this product
              const { data: existingItem } = await supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('cart_id', cart!.id)
                .eq('product_id', args.product_id)
                .maybeSingle();

              let cartItemId: string;

              if (existingItem) {
                // Update quantity
                const { error: updateError } = await supabase
                  .from('cart_items')
                  .update({ quantity: existingItem.quantity + args.quantity })
                  .eq('id', existingItem.id);

                if (updateError) {
                  console.error('Error updating cart item:', updateError);
                  throw updateError;
                }
                cartItemId = existingItem.id;
              } else {
                // Insert new cart item
                const { data: newItem, error: insertError } = await supabase
                  .from('cart_items')
                  .insert({
                    cart_id: cart!.id,
                    product_id: args.product_id,
                    quantity: args.quantity,
                    notes: args.notes,
                  })
                  .select()
                  .single();

                if (insertError) {
                  console.error('Error inserting cart item:', insertError);
                  throw insertError;
                }
                cartItemId = newItem!.id;
              }

              // Add addons if provided (works for both new and existing items)
              if (args.addon_ids && args.addon_ids.length > 0) {
                // Check which addons are already added to avoid duplicates
                const { data: existingAddons } = await supabase
                  .from('cart_item_addons')
                  .select('addon_id')
                  .eq('cart_item_id', cartItemId);

                const existingAddonIds = new Set(existingAddons?.map(a => a.addon_id) || []);
                const newAddonIds = args.addon_ids.filter((id: string) => !existingAddonIds.has(id));

                if (newAddonIds.length > 0) {
                  const addonInserts = newAddonIds.map((addonId: string) => ({
                    cart_item_id: cartItemId,
                    addon_id: addonId,
                  }));
                  const { error: addonError } = await supabase
                    .from('cart_item_addons')
                    .insert(addonInserts);

                  if (addonError) {
                    console.error('Error adding addons:', addonError);
                    throw addonError;
                  }
                  console.log(`Added ${newAddonIds.length} addon(s) to cart item ${cartItemId}`);
                }
              }

              newState = 'confirming_item';
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: functionName,
                content: JSON.stringify({
                  success: true,
                  product_name: product.name,
                  quantity: args.quantity,
                  price: product.price,
                }),
              });
              
              console.log(`[add_to_cart] ✅ Successfully added ${args.quantity}x ${product.name} to cart ${cart!.id}`);
              console.log('[add_to_cart] ================================================');
              break;
            }

            case 'remove_from_cart': {
              if (!cart) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'No active cart' }),
                });
                break;
              }

              const { data: itemToRemove } = await supabase
                .from('cart_items')
                .select('id')
                .eq('cart_id', cart!.id)
                .eq('product_id', args.product_id)
                .maybeSingle();

              if (itemToRemove) {
                await supabase.from('cart_items').delete().eq('id', itemToRemove.id);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: true }),
                });
              } else {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'Item not in cart' }),
                });
              }
              break;
            }

            case 'update_cart_item': {
              if (!cart) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'No active cart' }),
                });
                break;
              }

              const { data: itemToUpdate } = await supabase
                .from('cart_items')
                .select('id')
                .eq('cart_id', cart!.id)
                .eq('product_id', args.product_id)
                .maybeSingle();

              if (itemToUpdate) {
                await supabase
                  .from('cart_items')
                  .update({ quantity: args.quantity })
                  .eq('id', itemToUpdate.id);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: true }),
                });
              }
              break;
            }

            case 'set_delivery_address': {
              deliveryAddress = args.address;
              newState = 'collecting_payment';
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: functionName,
                content: JSON.stringify({ success: true, address: args.address }),
              });
              break;
            }

            case 'set_payment_method': {
              paymentMethod = args.method;
              newState = 'confirming_order';
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: functionName,
                content: JSON.stringify({ success: true, method: args.method }),
              });
              break;
            }

            case 'finalize_order': {
              if (!cart) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'No active cart to finalize' }),
                });
                break;
              }

              if (args.confirmed && deliveryAddress && paymentMethod) {
                // Calculate final total
                const { data: finalCart } = await supabase
                  .from('carts')
                  .select(`
                    cart_items (
                      id,
                      quantity,
                      products (id, name, price),
                      cart_item_addons (
                        addon_id,
                        addons (id, name, price)
                      )
                    )
                  `)
                  .eq('id', cart!.id)
                  .single();

                const finalTotal = finalCart!.cart_items.reduce((sum: number, item: any) => {
                  const itemTotal = item.products.price * item.quantity;
                  const addonsTotal = item.cart_item_addons.reduce(
                    (aSum: number, cia: any) => aSum + cia.addons.price,
                    0
                  ) * item.quantity;
                  return sum + itemTotal + addonsTotal;
                }, 0) + restaurant.delivery_fee;

                // Create order with status 'completed'
                const { data: newOrder, error: orderError } = await supabase
                  .from('orders')
                  .insert({
                    restaurant_id: restaurantId,
                    user_phone: customerPhone,
                    cart_id: cart!.id,
                    delivery_address: deliveryAddress,
                    payment_method: paymentMethod,
                    total_amount: finalTotal,
                    status: 'completed',
                  })
                  .select()
                  .single();

                if (orderError) {
                  console.error('[OrderCreation] Error creating order:', orderError);
                  throw orderError;
                }

                console.log(`[OrderCreation] ✅ Order created: ${newOrder.id} with status: completed`);

                // Mark cart as completed
                await supabase
                  .from('carts')
                  .update({ status: 'completed' })
                  .eq('id', cart!.id);

                console.log(`[CartSession] ✅ Cart ${cart!.id} marked as completed`);

                // CRITICAL: Clear cart reference - order is now completed, cart is no longer active
                const completedCartId = cart!.id;
                cart = null;
                console.log(`[CartSession] ✅ Cart reference cleared - ${completedCartId} is no longer active`);

                // Update customer insights (best-effort, non-blocking)
                try {
                  const orderItems = finalCart!.cart_items.map((item: any) => ({
                    productId: item.products.id,
                    productName: item.products.name,
                    addons: item.cart_item_addons?.map((cia: any) => ({
                      addonId: cia.addons.id,
                      addonName: cia.addons.name,
                    })) || [],
                  }));

                  await updateCustomerInsightsAfterOrder(supabase, {
                    phone: customerPhone,
                    orderId: newOrder.id,
                    total: finalTotal,
                    items: orderItems,
                    status: 'confirmed',
                  });
                } catch (insightsError) {
                  // Already logged in the helper, just continue
                  console.log('[OrderCreation] Customer insights update failed but order was created successfully');
                }

                newState = 'order_completed';
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: true, total: finalTotal, order_id: newOrder.id }),
                });
              } else {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'Missing address or payment method' }),
                });
              }
              break;
            }

            case 'cancel_order': {
              if (cart && cart.id) {
                // Mark cart as cancelled
                await supabase
                  .from('carts')
                  .update({ status: 'cancelled' })
                  .eq('id', cart.id);

                console.log(`[CartSession] ✅ Cart ${cart.id} cancelled`);

                // CRITICAL: Clear cart reference - cart is now cancelled, no longer active
                const cancelledCartId = cart.id;
                cart = null;
                console.log(`[CartSession] ✅ Cart reference cleared - ${cancelledCartId} is no longer active`);

                // If there's an associated order, mark it as cancelled too
                const { data: existingOrder } = await supabase
                  .from('orders')
                  .select('id')
                  .eq('cart_id', cancelledCartId)
                  .maybeSingle();

                if (existingOrder) {
                  await supabase
                    .from('orders')
                    .update({ status: 'cancelled' })
                    .eq('id', existingOrder.id);
                  console.log(`[OrderCancellation] ✅ Order ${existingOrder.id} cancelled`);
                }

                newState = 'idle';
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: true, message: 'Order cancelled' }),
                });
              } else {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'No active cart to cancel' }),
                });
              }
              break;
            }

            case 'get_customer_insights': {
              const insights = await getCustomerInsights(supabase, customerPhone);
              
              if (insights && insights.order_count >= 1) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({
                    success: true,
                    insights: {
                      order_count: insights.order_count,
                      average_ticket: insights.average_ticket,
                      order_frequency_days: insights.order_frequency_days,
                      preferred_items: insights.preferred_items,
                      preferred_addons: insights.preferred_addons,
                      rejected_items: insights.rejected_items,
                      last_interaction_at: insights.last_interaction_at,
                    }
                  }),
                });
                console.log(`[CustomerInsights] ✅ Retrieved insights for ${customerPhone}: ${insights.order_count} orders`);
              } else {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({
                    success: false,
                    message: 'No order history found for this customer. This is their first interaction.'
                  }),
                });
                console.log(`[CustomerInsights] No order history found for ${customerPhone}`);
              }
              break;
            }

            case 'get_last_completed_order': {
              const lastOrder = await getLastCompletedOrderForPhone(supabase, customerPhone, restaurantId);
              
              if (lastOrder) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({
                    success: true,
                    order: {
                      id: lastOrder.id,
                      date: lastOrder.created_at,
                      total: lastOrder.total,
                      items: lastOrder.items,
                      delivery_address: lastOrder.delivery_address,
                      payment_method: lastOrder.payment_method,
                    }
                  }),
                });
                console.log(`[LastOrder] ✅ Retrieved last order for ${customerPhone}: ${lastOrder.id}`);
              } else {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({
                    success: false,
                    message: 'No completed orders found for this customer'
                  }),
                });
                console.log(`[LastOrder] No completed orders found for ${customerPhone}`);
              }
              break;
            }

            case 'transition_state': {
              if (canTransition(currentState, args.next_state)) {
                newState = args.next_state;
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: true, new_state: newState }),
                });
              } else {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'Invalid state transition' }),
                });
              }
              break;
            }
          }
        } catch (toolError) {
          console.error(`Error executing tool ${functionName}:`, toolError);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: JSON.stringify({
              success: false,
              error: toolError instanceof Error ? toolError.message : 'Unknown error',
            }),
          });
        }
      }

      // CRITICAL: Determine next state based on tool executions (SERVER-SIDE LOGIC)
      // Do NOT rely solely on LLM's state suggestion - backend is authoritative
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        const lastToolName = aiMessage.tool_calls[aiMessage.tool_calls.length - 1].function.name;
        
        // Reload cart to check current items
        const cartAfterTools = await getActiveCartWithItems(supabase, restaurantId, customerPhone);
        const hasItems = cartAfterTools && cartAfterTools.cart_items && cartAfterTools.cart_items.length > 0;
        const hasAddress = !!deliveryAddress;
        const hasPayment = !!paymentMethod;
        
        // Only apply deterministic state transitions if LLM didn't explicitly request a transition
        if (lastToolName !== 'transition_state') {
          // Determine next state based on tool and context
          const determinedState = determineNextState(
            currentState,
            lastToolName,
            hasItems,
            hasAddress,
            hasPayment
          );
          
          // Update state if it changed
          if (determinedState !== currentState) {
            newState = determinedState;
            console.log(`[StateMachine] ✅ State transition: ${currentState} -> ${newState} (triggered by ${lastToolName})`);
          }
        } else {
          console.log(`[StateMachine] ✅ State transition: ${currentState} -> ${newState} (LLM explicit request)`);
        }
        
        // Update conversation state in database
        await updateConversationState(
          supabase,
          conversationStateRecord.id,
          newState,
          cartAfterTools?.id || null
        );
      }

      // Make second OpenAI call with tool results to get final response
      const followUpMessages = [
        ...messages,
        aiMessage,
        ...toolResults,
      ];

      const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: followUpMessages,
          temperature: 0.7,
        }),
      });

      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        const finalMessage = followUpData.choices[0].message;
        console.log('Final AI Response:', finalMessage.content);

        const responseText = finalMessage.content || 'Produto adicionado ao carrinho!';

        console.log(`State transition: ${currentState} -> ${newState}`);

        // Reload active cart after tool execution
        // CRITICAL: Always use getActiveCartWithItems to ensure we only work with active carts
        console.log('[AI-Agent] ========== RELOADING CART AFTER TOOL EXECUTION ==========');
        const updatedCart = await getActiveCartWithItems(supabase, restaurantId, customerPhone);
        
        if (updatedCart) {
          const itemCount = updatedCart.cart_items?.length || 0;
          console.log(`[AI-Agent] ✅ Reloaded active cart ${updatedCart.id} with ${itemCount} items`);
          if (itemCount > 0) {
            const itemSummary = updatedCart.cart_items.map((i: any) => `${i.quantity}x ${i.products.name}`).join(', ');
            console.log(`[AI-Agent] Items in cart: ${itemSummary}`);
          } else {
            console.log('[AI-Agent] ⚠️ Cart is EMPTY (no items yet)');
          }
        } else {
          console.log('[AI-Agent] ❌ No active cart after tool execution - cart was completed/cancelled or does not exist');
        }
        
        // If cart is no longer active (completed/cancelled), use empty cart
        const updatedCartItems: CartItem[] = updatedCart?.cart_items?.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.products.name,
          quantity: item.quantity,
          price: item.products.price,
          notes: item.notes,
          addons: item.cart_item_addons?.map((cia: any) => ({
            addon_id: cia.addon_id,
            name: cia.addons.name,
            price: cia.addons.price,
          })) || [],
        })) || [];

        console.log('[AI-Agent] Final current_cart_items for response:', updatedCartItems.length, 'items');
        console.log('[AI-Agent] ================================================================');

        // Save outgoing message
        await supabase.from('messages').insert({
          restaurant_id: restaurantId,
          from_number: restaurant.phone,
          to_number: customerPhone,
          body: responseText,
          direction: 'outbound',
        });

        // Send WhatsApp message
        try {
          await supabase.functions.invoke('whatsapp-send', {
            body: {
              restaurantId,
              customerPhone,
              messageText: responseText,
            },
          });
        } catch (sendError) {
          console.error('Error sending WhatsApp message:', sendError);
        }

        return new Response(
          JSON.stringify({
            response: responseText,
            state: newState,
            cart: updatedCartItems,
            delivery_address: deliveryAddress,
            payment_method: paymentMethod,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        console.error('Follow-up OpenAI call failed');
        throw new Error('Failed to get AI response after tool execution');
      }
    } else {
      // No tool calls, use direct response
      const responseText = aiMessage.content || 'Olá! Como posso ajudar?';

      // For no-tool-call scenarios, potentially transition state based on conversation flow
      // If user says hi/hello and state is order_completed, reset to idle
      if (currentState === 'order_completed') {
        newState = 'idle';
        await updateConversationState(
          supabase,
          conversationStateRecord.id,
          newState,
          null // No cart for idle state
        );
        console.log(`[StateMachine] ✅ Reset to idle after order completion`);
      } else if (currentState === 'idle' && (currentCartItems.length > 0 || messageBody.toLowerCase().includes('menu') || messageBody.toLowerCase().includes('cardápio'))) {
        // If in idle and user asks about menu or has items, transition to browsing
        newState = 'browsing_menu';
        await updateConversationState(
          supabase,
          conversationStateRecord.id,
          newState,
          cart?.id || null
        );
        console.log(`[StateMachine] ✅ Transition to browsing_menu`);
      }

      console.log(`State: ${currentState} -> ${newState} (no tool calls)`);

      // Save outgoing message
      await supabase.from('messages').insert({
        restaurant_id: restaurantId,
        from_number: restaurant.phone,
        to_number: customerPhone,
        body: responseText,
        direction: 'outbound',
      });

      // Send WhatsApp message
      try {
        await supabase.functions.invoke('whatsapp-send', {
          body: {
            restaurantId,
            customerPhone,
            messageText: responseText,
          },
        });
      } catch (sendError) {
        console.error('Error sending WhatsApp message:', sendError);
      }

      return new Response(
        JSON.stringify({
          response: responseText,
          state: newState,
          cart: currentCartItems,
          delivery_address: deliveryAddress,
          payment_method: paymentMethod,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Error in whatsapp-ai-agent:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
