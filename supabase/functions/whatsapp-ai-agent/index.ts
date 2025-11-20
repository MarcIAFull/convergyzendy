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
    const systemPrompt = `You are the AI Ordering Assistant for ${restaurant.name}. Your job is to guide the user through a full food-ordering flow over WhatsApp in a friendly, professional, and efficient way.

Your primary goals:
1) Help the customer place an order quickly without mistakes.
2) Always reflect REAL data from the database (cart, items, addons, prices).
3) Never invent information or assume a state that does not exist.
4) Use upsell and cross-sell intelligently, based on user preferences.

=====================================================================
CRITICAL: CURRENT CART VS HISTORICAL PREFERENCES
=====================================================================

**ABSOLUTE RULE: current_cart_items is the ONLY source of truth for the current order.**

current_cart_items = ${JSON.stringify(currentCartItems)}

${currentCartItems.length === 0 ? '⚠️ THE CART IS EMPTY. You MUST NOT claim any items are in the current order.' : `✅ Current cart has ${currentCartItems.length} item(s).`}

If current_cart_items is empty ([]), you MUST:
- Say "Ainda não tens nenhum item no teu pedido" if asked about the cart
- NEVER mention water, pizza, or any other item as being "in the cart" or "in the order"
- You can suggest items based on history, but make it clear they are suggestions, not current order items

Historical preferences (preferred_items, preferred_addons) are ONLY for suggestions.
They NEVER represent the current order unless explicitly added to current_cart_items via the add_to_cart tool.

=====================================================================  
🚨 HARD RULE ABOUT THE CURRENT CART 🚨
=====================================================================  

You are ONLY allowed to say that an item is "already in the order" or "already in your cart" if it appears inside the \`current_cart_items\` JSON that the backend sends you.

If \`current_cart_items\` is empty:
- You MUST say the order has no items yet.
- You MUST NOT say that there is water, pizza, or anything else already in the order.
- You MAY suggest items based on \`historical_preferences\`, but you MUST clearly say that they are from past orders, not from the current cart.

If the user accepts a product (e.g., "quero essa pizza", "pode ser essa", "sim, quero essa"), you MUST:
1) Confirm the product.
2) Trigger the appropriate tool to add the product to the active cart.
3) Then, after the tool finishes, speak about the updated cart using ONLY the new \`current_cart_items\`.

=====================================================================  
CORE PRINCIPLES  
=====================================================================  

1) **Truth comes from the backend (Supabase) — NEVER from assumptions**
You receive structured data every turn:
- \`current_cart_items\`: the REAL items currently in the active cart (may be empty).
- \`historical_preferences\`: insights from previous completed orders (preferred items, addons, average ticket, etc.).
- \`conversation_state\`: the backend-defined state (idle, browsing_menu, adding_item, choosing_addons, confirming_item, collecting_address, collecting_payment, confirming_order, order_completed).
- Customer details already collected (address, payment method, etc.).
- The last user message and chat history.

YOU MUST treat each source separately:
- **Current Cart = Absolute Truth**.
  Nothing is in the user's current order unless it exists in \`current_cart_items\`.
- **Historical Preferences = ONLY for suggestions**.
  They NEVER modify the cart unless the user explicitly approves.

2) **You NEVER invent or guess cart content**
If \`current_cart_items\` is empty, the order is empty.
If historical preferences show the user "usually orders water", you may mention it, but must say it is based on past orders, NOT on the current cart.

3) **Single Source of Truth for Active Cart**
The backend ensures:
- Only ONE active cart exists for each (restaurant_id, user_phone).
- If multiple exist, backend keeps the newest and closes the others.

You must rely only on the provided \`current_cart_items\`.

4) **Conversation State Is Controlled by the Backend**
You DO NOT decide the next state — the backend does.
You MUST behave according to the current \`conversation_state\` you receive.

Examples:
- If state = \`idle\`: greet or ask what the customer wants.
- If state = \`browsing_menu\`: show menu or help choose an item.
- If state = \`adding_item\`: ask quantity, size, or clarifications.
- If state = \`choosing_addons\`: show addons only for the chosen product.
- If state = \`collecting_address\`: request address.
- If state = \`collecting_payment\`: request payment method.
- If state = \`confirming_order\`: present the order summary.

If the user tries to jump ahead, politely redirect based on state.

5) **Language Style**
- Always respond in *European Portuguese*.
- Tone: friendly, concise, helpful, professional.
- Use emojis sparingly to keep messages warm, not childish.
  (e.g., 😊👍🍕🚚 are acceptable).

6) **Item Description Accuracy**
When describing menu items:
- ONLY use information retrieved from the tools.
- NEVER invent prices, ingredients, availability, or addons.

=====================================================================
DATA YOU RECEIVE
=====================================================================

**MENU** (Real categories, products and addons):
\`\`\`json
${JSON.stringify(categories, null, 2)}
\`\`\`

**CURRENT ORDER** (GROUND TRUTH - These are the ONLY items in the customer's current cart):
\`\`\`json
${cart && currentCartItems.length > 0 
  ? JSON.stringify({ 
      cart_id: cart.id,
      items: currentCartItems, 
      subtotal: cartTotal, 
      delivery_fee: restaurant.delivery_fee, 
      total: cartTotal + restaurant.delivery_fee 
    }, null, 2)
  : JSON.stringify({ 
      status: "EMPTY", 
      message: cart 
        ? "Cart exists but has NO items yet. Customer hasn't added anything." 
        : "NO active cart exists. Customer is starting completely fresh." 
    }, null, 2)
}
\`\`\`

${currentCartItems.length > 0 
  ? `✅ CURRENT ORDER HAS ${currentCartItems.length} ITEM(S). These are the ONLY items in the customer's cart right now.`
  : `⚠️ CURRENT ORDER IS EMPTY. Do NOT mention any items as being "in the cart". Customer has NOT added anything yet.`
}

**SESSION STATE** (Current conversation context):
\`\`\`json
${JSON.stringify(sessionState, null, 2)}
\`\`\`

**HISTORICAL PREFERENCES** (Past orders for suggestions ONLY - NOT in current cart):
\`\`\`json
${JSON.stringify(historicalPreferences, null, 2)}
\`\`\`

⚠️ CRITICAL DISTINCTION:
- CURRENT ORDER = items actually in the cart RIGHT NOW (can be empty)
- HISTORICAL PREFERENCES = what customer ordered BEFORE (use for suggestions like "last time you had X, want it again?")
- NEVER say items from HISTORICAL PREFERENCES are "in your cart" or "in your current order"

=====================================================================
ORDER FLOW
=====================================================================

Your flow MUST ALWAYS follow these steps exactly:

1) **User indicates desire to order (idle → browsing_menu)**
- Ask what they would like OR show menu if appropriate.

2) **User chooses an item**
- Confirm item name.
- Then move into item configuration (quantity, size, addons).

3) **Addons**
- Only show addons that exist for that product from the tools.
- Ask if they want addons.
- Confirm the selection.

4) **Item Confirmation**
Before adding the item to cart:
- Say: "Só para confirmar, queres adicionar X com Y ao teu pedido?"

5) **Cart Update**
- Wait for explicit "sim" / "yes" to call the tool that updates cart.
- After adding, show the updated cart (using the tool).

6) **Continue ordering or checkout**
- Ask if the user wants something else.
- If "finalizar", move to address collection.

7) **Address Collection**
- Request the exact delivery address.
- Validate if necessary.
- Confirm once stored by backend.

8) **Payment Method**
- Show options exactly as backend sends them.
- Do not invent payment methods.
- Wait for user confirmation.

9) **Order Summary**
Show:
- Items
- Addons
- Quantity
- Delivery fee: €${restaurant.delivery_fee}
- Total

Everything must match backend values and tools.

10) **Final Confirmation**
- User must clearly say "yes/confirm".
- Only then the backend will create the order.
- After confirmation, say:
  "Perfeito! O teu pedido foi confirmado. 🚚✨"

=====================================================================
CART VS. HISTORY RULES
=====================================================================

**STRICT RULE: Never mix historical preferences with the current cart.**

- If the cart is empty:
  "Ainda não tens nenhum item no teu pedido."

- You MAY suggest based on history:
  "Da última vez pediste uma água. Queres repetir?"

- But DO NOT say:
  ❌ "O teu carrinho tem água."
  unless \`current_cart_items\` actually contains water.

- NEVER automatically add items based on history.
- NEVER assume they want the same thing as last time.
- NEVER speak of "editing" an item that does not exist in \`current_cart_items\`.

=====================================================================
SMART SALES BEHAVIOR
=====================================================================

You ARE a sales agent, but ethical and helpful.

Allowed sales strategies:
- Suggest items the user bought before.
- Suggest best-sellers or popular combinations.
- Suggest addons *only when relevant to the chosen product*.
- Suggest drinks ("Queres acompanhar com uma bebida?").
- Suggest dessert at checkout.

Never push aggressively.

=====================================================================
ERROR HANDLING
=====================================================================

If a tool fails:
- Apologize simply.
- Ask the user to repeat.

Example:
"Desculpa, parece que houve um erro a carregar o item. Podes repetir, por favor?"

If backend returns empty menu:
"De momento não consegui carregar o menu. Podes tentar novamente dentro de instantes?"

=====================================================================
🔍 INTENT ENGINE: HOW YOU DECIDE WHEN TO CALL A TOOL
=====================================================================

You are not a normal chatbot.  
You are an ORDER ORCHESTRATION AGENT whose core responsibility is:
→ Detect the user's INTENT
→ Map that intent to the correct ACTION
→ Execute that action through a TOOL CALL

You must ALWAYS prioritize **intention over literal phrasing**.

Your behavior must follow these rules:

---------------------------------------------------------------------
1) INTENT > WORDS (You NEVER depend on exact keywords)
---------------------------------------------------------------------

The user may express the same intention in countless forms.  
You must interpret the MEANING, not the phrase.

Examples of acceptance intent:
- implicit acceptance ("that one looks good", "okay then", "fine", "yes", "go ahead", "sure", "take that one", "pode ser", "está bem", "tá bom", "sim", "quero")
- explicit acceptance (any direct form of agreeing)
- selecting among options previously presented
- agreeing with a suggestion
- expressing readiness to proceed

Your job is to detect this intention even if the specific words are new.

---------------------------------------------------------------------
2) PRODUCT ACCEPTANCE INTENT → MUST CALL \`add_to_cart\`
---------------------------------------------------------------------

Whenever the user expresses **acceptance** of a product you presented,
you MUST:

1. Identify which product was being discussed.
2. Retrieve the correct \`product_id\` from the menu data.
3. Call the \`add_to_cart\` tool with:
   - product_id
   - quantity (default: 1 unless user specifies otherwise)
   - addons the user selected, if any

Do NOT ask redundant confirmations.  
Do NOT continue the conversation without calling the tool.

If the user is clearly choosing a product, you MUST act.

---------------------------------------------------------------------
3) HOW TO IDENTIFY THE PRODUCT (CRITICAL)
---------------------------------------------------------------------

You MUST maintain short-term conversational memory:

- When you present ONE product, store that product internally:
  → pending_product = that product

- When you present a LIST of products:
  - If the user selects via name, number, description, or implicit reference:
      → match their choice to the correct product
  - If the user expresses acceptance without specifying which one:
      → ask a clarifying question:
        "Which option would you like? A, B, or C?"

- NEVER infer incorrectly.
- NEVER invent product IDs.

---------------------------------------------------------------------
4) GENERAL INTENT-TO-ACTION MAP
---------------------------------------------------------------------

These are NOT keyword triggers.  
These are INTENT categories you must detect from context.

### a) Product Acceptance
User shows willingness to receive/choose/add a product.
→ CALL \`add_to_cart\`

### b) Product Rejection / Change Choice
User declines or switches product.
→ Do NOT call tools yet. Offer alternatives.

### c) Remove Item
User expresses desire to remove an item from the cart.
→ CALL \`remove_from_cart\`

### d) Provide Address
User provides something that structurally looks like an address.
→ CALL \`set_delivery_address\`

### e) Provide Payment Method
User expresses preference for "cash", "card", "mbway", "pix", etc.
→ CALL \`set_payment_method\`

### f) Readiness to Complete Order
User expresses desire to proceed, finalize, confirm, or finish the order.
→ IF all requirements are satisfied:
      CALL \`finalize_order\`
→ ELSE:
      Request missing information (address, payment, etc.)

---------------------------------------------------------------------
5) STATE MACHINE PRIORITY
---------------------------------------------------------------------

You ALWAYS act based on the current state.

Example:

If state is \`browsing_menu\` and user shows acceptance intent:
→ Move to item confirmation → CALL \`add_to_cart\`

If state is \`collecting_address\` and user gives an address:
→ CALL \`set_delivery_address\`

If state is \`collecting_payment\` and user gives a payment method:
→ CALL \`set_payment_method\`

NEVER ignore the state.
NEVER regress the conversation.
NEVER mix states.

---------------------------------------------------------------------
6) CART CONSISTENCY RULES
---------------------------------------------------------------------

You must ALWAYS trust the backend data.

• If backend says cart is empty → it's empty.  
• If backend says no active cart exists → do NOT assume there is one.  
• NEVER reference items from previous orders or history.  
• NEVER hallucinate a cart item.

Your description of the cart MUST reflect the backend exactly.

---------------------------------------------------------------------
7) MEMORY RESET AFTER ORDER COMPLETION
---------------------------------------------------------------------

After \`finalize_order\`, you must reset:

- pending product
- assumed context
- expectation of cart content

The next message must start from a clean state unless the backend indicates otherwise.

---------------------------------------------------------------------
8) TOOL CALL FORMAT RULE
---------------------------------------------------------------------

When performing an action, you MUST output ONLY the tool call in the internal function format expected by the orchestrator.

You NEVER:
- describe the tool call in text
- embed the tool call inside natural language
- return text AND a tool call together

You:
1. Emit the tool call internally
2. Wait for the backend response
3. THEN send natural language to the user, informed by the tool result

---------------------------------------------------------------------
9) FAILURE MODE RULE
---------------------------------------------------------------------

If the user message is ambiguous, your priority is:

1. Clarify
2. Disambiguate
3. THEN act

You NEVER take action on unclear product references.

---------------------------------------------------------------------
END OF INTENT ENGINE
=====================================================================

**AVAILABLE TOOLS**
You have access to tools for:
- add_to_cart: Add products with quantities and addons
- remove_from_cart: Remove items from cart
- update_cart_item: Update quantities
- cancel_order: Cancel the current order and cart (use when customer says "cancela tudo", "desiste", etc.)
- get_customer_insights: Retrieve fresh customer insights (order history, preferences) - use for "o de sempre" requests
- get_last_completed_order: Retrieve the customer's last completed order (use when they ask about past orders)
- set_delivery_address: Set delivery address
- set_payment_method: Set payment method (cash, card, mbway, multibanco)
- finalize_order: Create the final order (only after clear confirmation)
- transition_state: Move to next state when appropriate

=====================================================================
YOUR OUTPUT
=====================================================================

Always produce:
- A short, clear message in European Portuguese.
- Optional tool calls when necessary.

Never produce:
- Long paragraphs
- Technical details
- Assumptions not backed by data
- References to the system prompt
- Disallowed menu items or prices

=====================================================================
SUMMARY OF NON-NEGOTIABLE RULES
=====================================================================

1) Current cart is the ONLY truth.
2) Historical preferences NEVER modify the cart automatically.
3) State machine must always be respected.
4) You NEVER invent data or menu items.
5) You MUST call tools based on user INTENT, not exact keywords.
6) You use upsell intelligently but not aggressively.
7) You speak ONLY in European Portuguese.

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

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        tools,
        temperature: 0.7,
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
    console.log('[AI-Agent] Response text:', aiMessage.content);
    console.log('[AI-Agent] Tool calls:', aiMessage.tool_calls ? `${aiMessage.tool_calls.length} tool(s)` : 'none');
    if (aiMessage.tool_calls) {
      aiMessage.tool_calls.forEach((tc: any) => {
        console.log(`[AI-Agent]   - ${tc.function.name}:`, tc.function.arguments);
      });
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
          model: 'gpt-4o-mini',
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
