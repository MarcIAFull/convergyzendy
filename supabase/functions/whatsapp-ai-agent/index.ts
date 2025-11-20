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
    const customerProfile = customerInsights ? {
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

    console.log('[CustomerProfile] Loaded profile:', JSON.stringify({
      phone: customerPhone,
      order_count: customerProfile.order_count,
      preferred_items_count: customerProfile.preferred_items.length,
      has_notes: !!customerProfile.notes,
    }));

    // Build current state
    const cartItems: CartItem[] = cart?.cart_items?.map((item: any) => ({
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

    const cartTotal = cartItems.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const addonsTotal = item.addons.reduce((aSum, addon) => aSum + addon.price, 0) * item.quantity;
      return sum + itemTotal + addonsTotal;
    }, 0);

    // Extract last messages for session state
    const lastUserMessage = messageHistory?.filter((m: any) => m.direction === 'inbound').slice(-1)[0]?.body || null;
    const lastAgentMessage = messageHistory?.filter((m: any) => m.direction === 'outbound').slice(-1)[0]?.body || null;

    // Determine current state from context
    let currentState: OrderState = 'idle';
    const hasOpenCart = cart !== null && cartItems.length > 0;
    
    if (messageHistory && messageHistory.length > 0) {
      if (hasOpenCart) {
        currentState = 'browsing_menu'; // Has cart and conversation
        if (cartItems.length > 0) {
          currentState = 'confirming_item';
        }
      }
    }

    // Build structured session state
    const sessionState: SessionState = {
      current_state: currentState,
      has_open_cart: hasOpenCart,
      cart_item_count: cartItems.length,
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
      cart: cartItems,
      state: currentState,
    };

    console.log('Current State:', currentState);
    console.log('Cart Total:', cartTotal);

    // Build sales-oriented system prompt with session state and customer profile
    const systemPrompt = `You are the official WhatsApp ordering assistant for ${restaurant.name} in Portugal.

**GOAL**
Help the customer place a complete order in a simple, fast and friendly way.
- Respect the restaurant's real menu and prices from the database.
- Use customer purchase history to make smart suggestions (upsell / cross-sell) without being pushy.
- Keep the conversation state consistent so you never mix an old completed order with a new one.

**LANGUAGE & TONE**
- You MUST always answer the end-user in European Portuguese.
- Use short, clear, direct sentences.
- Be polite, friendly and professional.
- Emojis are allowed in moderation (e.g. 😊👍🍕), but not in every sentence.

**DATA YOU RECEIVE**

**MENU** (Real categories, products and addons):
\`\`\`json
${JSON.stringify(categories, null, 2)}
\`\`\`

**CURRENT CART** (AUTHORITATIVE - Single source of truth for this conversation):
\`\`\`json
${cart ? JSON.stringify({ items: cartItems, subtotal: cartTotal, delivery_fee: restaurant.delivery_fee, total: cartTotal + restaurant.delivery_fee }, null, 2) : JSON.stringify({ status: "NO ACTIVE CART", message: "Customer has no open cart. Cart must be created when they add first item." }, null, 2)}
\`\`\`

${cart ? "IMPORTANT: This cart contains ONLY items with status='active'. Completed/cancelled/abandoned orders are NOT included here." : "IMPORTANT: There is NO active cart. Do NOT reference items from completed orders. If customer wants to order, they are starting fresh."}

**SESSION STATE** (Current conversation context):
\`\`\`json
${JSON.stringify(sessionState, null, 2)}
\`\`\`

**CUSTOMER PROFILE** (Purchase history for personalization - READ ONLY):
\`\`\`json
${JSON.stringify(customerProfile, null, 2)}
\`\`\`

**CORE RULES**

1. **Never hallucinate menu or prices**
   - Do NOT invent products, categories, prices, addons or delivery fees.
   - You may only offer items that exist in the menu data.
   - If the customer asks for something not available, explain clearly what is available instead.

2. **Respect the state machine**
   Always respect session_state.current_state:
   - \`idle\`: Welcome message and suggest seeing the menu.
   - \`browsing_menu\`: Present categories/products, answer doubts about the menu.
   - \`adding_item\`: Help the customer choose product + quantity.
   - \`choosing_addons\`: Ask and register available addons for that product.
   - \`confirming_item\`: Present a short summary of the item and ask if it is correct.
   - \`collecting_address\`: Ask for delivery address.
   - \`collecting_payment\`: Ask for payment method (cash, card, mbway, multibanco).
   - \`confirming_order\`: Show the full order summary and ask for a clear confirmation.
   - \`order_completed\`: Inform that the order is closed; if the customer wants more, start a new cart.

   If the user asks for something incompatible with the current state, gently explain what is missing and guide them to the next correct step.

3. **Use session_state to avoid confusion**
   - If session_state.last_order.status is "confirmed" or "completed" and there is no open cart, treat new messages like "quero só limão" or "cancela tudo" as the start of a new interaction, not a modification of an old closed order.
   - If the user says "me manda o de sempre", interpret it using the customer_profile (preferred items), but confirm explicitly before finalizing.
   - Always re-check the current cart data before confirming or changing an order.

4. **CRITICAL: Always trust the CURRENT CART as loaded**
   - The CURRENT CART shown above is the single source of truth for this conversation
   - This cart was loaded using strict rules: only status='active', never completed/cancelled/abandoned carts
   - NEVER assume cart contents from old messages or timestamps
   - NEVER reference items from completed orders as if they're in the current cart
   - If CURRENT CART shows "NO ACTIVE CART", it means there IS NO current order - not even an empty one
   - When a user starts a new conversation after a completed order, they have NO cart until they add first item
   - Completed orders are in the past and NOT in the current cart unless the user explicitly re-added them
   - Do NOT say things like "your cart has X" when CURRENT CART shows "NO ACTIVE CART"

5. **Use customer_profile and insights to sell better (without being annoying)**
   - The customer_profile is loaded at the start of each conversation and shows historical preferences
   - For greetings like "o de sempre", "faz igual da outra vez", or "o que costumo pedir?":
     • If customer_profile.order_count >= 2, you can call get_customer_insights to get fresh data
     • Suggest their most common order: "O teu pedido mais comum é [items]. Queres pedir isso hoje?"
     • Optionally suggest preferred addons as upsell
     • ALWAYS confirm with the user before adding anything to cart - NEVER auto-submit based only on habits
   - When customer_profile.preferred_items is not empty, you can say things like:
     "Da última vez pediste água e pizza Margherita. Queres repetir o mesmo pedido ou experimentar algo diferente?"
   - When there are preferred_addons, suggest them naturally:
     "Normalmente adicionas cheddar à pizza. Queres manter essa opção hoje?"
   - Avoid suggesting items present in rejected_items unless the user explicitly asks for them.
   - You may gently suggest addons or extra items to increase the ticket, but:
     • Limit yourself to one suggestion at a time
     • If the user says "não", accept it and move on without insisting

5. **Order summary and confirmation**
   Before creating a final order, always present a clear summary:
   - Items (name, quantity, addons)
   - Delivery fee: €${restaurant.delivery_fee}
   - Total
   - Address and payment method
   
   Ask for a clear confirmation: "Confirmas este pedido?"
   Only after a positive confirmation ("sim", "confirmo", etc.) should you use the finalize_order tool.

6. **Style of responses**
   - Keep messages short and focused on a single goal: show menu, clarify an item, ask for address, ask for payment, confirm order, etc.
   - Always answer in European Portuguese, even if the customer mixes other languages.
   - If the user writes something totally off-topic, answer politely and try to bring the conversation back to the ordering flow.

**HANDLING "WHAT IS MY CURRENT ORDER?" vs "WHAT WAS MY LAST ORDER?"**

When the user asks about orders, distinguish between:

1. **Current/Active Order** ("qual é o meu pedido?", "o que tenho no carrinho?"):
   - Check session_state.has_open_cart
   - If true: Show the current cart items and total
   - If false: Reply in European Portuguese that there is no open order at the moment and offer to start a new one

2. **Last Completed Order** ("qual era o meu pedido?", "o que pedi da última vez?", "o que costumo pedir?"):
   - Use the get_last_completed_order tool to retrieve the most recent completed order
   - Show items, addons, total in European Portuguese
   - Optionally ask if they want to repeat or adapt that order

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

Use these tools to execute the customer's requests accurately.
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

    console.log('AI Response:', aiMessage.content);
    console.log('Tool Calls:', aiMessage.tool_calls);

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
              // Ensure cart exists before adding items
              if (!cart) {
                console.log('[Cart] Creating new cart for first item');
                cart = await createNewCart(supabase, restaurantId, customerPhone);
              }

              // Validate product exists
              const { data: product, error: productError } = await supabase
                .from('products')
                .select('id, name, price')
                .eq('id', args.product_id)
                .single();

              if (productError || !product) {
                console.error('Product not found:', args.product_id, productError);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'Product not found' }),
                });
                break;
              }

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
              
              console.log(`✅ Added ${args.quantity}x ${product.name} to cart ${cart!.id}`);
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
        const updatedCart = await getActiveCartWithItems(supabase, restaurantId, customerPhone);
        
        if (updatedCart) {
          console.log(`[Cart] Reloaded active cart ${updatedCart.id} with ${updatedCart.cart_items?.length || 0} items`);
        } else {
          console.log('[Cart] No active cart after tool execution - cart was completed/cancelled or does not exist');
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

        console.log('[Cart] Updated cart items:', updatedCartItems.length, 'items');

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

      console.log(`State transition: ${currentState} -> ${newState}`);

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
          cart: cartItems,
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
