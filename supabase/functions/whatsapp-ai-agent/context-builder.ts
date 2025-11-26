/**
 * Unified Context Builder for WhatsApp AI Agent
 * 
 * Consolidates all context loading and formatting logic in one place.
 * Both orchestrator and conversational AI agents consume this shared context.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

export interface ConversationContext {
  // Raw data
  restaurant: any;
  restaurantAISettings: any | null;
  promptOverrides: any[];
  availableProducts: any[];
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  activeCart: any | null;
  cartItems: any[];
  customer: any | null;
  pendingItems: any[];
  conversationState: any;
  lastShownProducts: Array<{ id: string; name: string }>;
  
  // Computed values
  cartTotal: number;
  currentState: string;
  stateMetadata: any;
  
  // Formatted strings (for template variables)
  formatted: {
    menu: string;
    cart: string;
    customer: string;
    history: string;
    pendingItems: string;
  };
}

/**
 * Build complete conversation context from database
 */
export async function buildConversationContext(
  supabase: any, // Use 'any' to avoid complex Supabase type issues
  restaurantId: string,
  customerPhone: string,
  rawMessage: string
): Promise<ConversationContext> {
  console.log('[Context Builder] ========== LOADING UNIFIED CONTEXT ==========');
  
  // ============================================================
  // LOAD RESTAURANT & SETTINGS
  // ============================================================
  
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .maybeSingle();

  if (!restaurant) throw new Error('Restaurant not found');
  console.log(`[Context Builder] Restaurant: ${restaurant.name}`);

  const { data: restaurantAISettings } = await supabase
    .from('restaurant_ai_settings')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  
  console.log(`[Context Builder] AI Settings: ${restaurantAISettings ? 'Loaded' : 'Using defaults'}`);

  const { data: promptOverrides } = await supabase
    .from('restaurant_prompt_overrides')
    .select('*')
    .eq('restaurant_id', restaurantId);
  
  console.log(`[Context Builder] Prompt Overrides: ${promptOverrides?.length || 0}`);

  // ============================================================
  // LOAD MENU
  // ============================================================
  
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

  const availableProducts = categories?.flatMap((cat: any) => 
    (cat.products || [])
      .filter((p: any) => p && p.name && p.id) // Filter out null/invalid products
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        category: cat.name,
        addons: p.addons || []
      }))
  ) || [];

  console.log(`[Context Builder] Menu: ${availableProducts.length} products`);

  // ============================================================
  // LOAD CONVERSATION HISTORY
  // ============================================================
  
  const { data: messageHistory } = await supabase
    .from('messages')
    .select('body, direction, timestamp')
    .eq('restaurant_id', restaurantId)
    .or(`from_number.eq.${customerPhone},to_number.eq.${customerPhone}`)
    .order('timestamp', { ascending: false })
    .limit(10);

  const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = 
    (messageHistory || []).reverse().map((msg: any) => ({
      role: (msg.direction === 'incoming' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.body
    }));

  console.log(`[Context Builder] History: ${conversationHistory.length} messages`);

  // ============================================================
  // LOAD ACTIVE CART
  // ============================================================
  
  const { data: activeCarts } = await supabase
    .from('carts')
    .select(`
      id, status, created_at, metadata,
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
  
  // Load cart items with addons
  let cartItems: any[] = [];
  if (activeCart) {
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
      .eq('cart_id', activeCart.id);
    
    cartItems = (itemsWithAddons || [])
      .filter((item: any) => item && item.products && item.products.name) // Filter out null/invalid items
      .map((item: any) => {
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
  }

  const cartTotal = cartItems.reduce((sum: number, item: any) => sum + item.total_price, 0);
  console.log(`[Context Builder] Cart: ${cartItems.length} items, Total: €${cartTotal.toFixed(2)}`);

  // ============================================================
  // LOAD CUSTOMER PROFILE
  // ============================================================
  
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', customerPhone)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  console.log(`[Context Builder] Customer: ${customer ? customer.name || 'Found (no name)' : 'New'}`);

  // ============================================================
  // LOAD PENDING ITEMS
  // ============================================================
  
  const { data: pendingItemsData } = await supabase
    .from('conversation_pending_items')
    .select(`
      *,
      products (id, name, price, description)
    `)
    .eq('user_phone', customerPhone)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const pendingItems = (pendingItemsData || []).map((item: any) => {
    // Load addons for each pending item
    const addons = (item.addon_ids || [])
      .map((addonId: string) => {
        const product = availableProducts.find((p: any) => p.id === item.product_id);
        return product?.addons?.find((a: any) => a.id === addonId);
      })
      .filter(Boolean);
    
    return {
      id: item.id,
      product_id: item.product_id,
      product: item.products,
      quantity: item.quantity,
      addon_ids: item.addon_ids || [],
      addons,
      notes: item.notes,
      status: item.status
    };
  });

  console.log(`[Context Builder] Pending items: ${pendingItems.length}`);

  // ============================================================
  // LOAD/CREATE CONVERSATION STATE
  // ============================================================
  
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
  const lastShownProducts = (conversationState?.last_shown_products || []) as Array<{id: string; name: string}>;

  console.log(`[Context Builder] State: ${currentState}`);
  console.log(`[Context Builder] Pending items: ${pendingItems.length}`);
  console.log(`[Context Builder] Last shown products: ${lastShownProducts.length}`);

  // ============================================================
  // FORMAT ALL CONTEXT DATA
  // ============================================================
  
  const formatted = {
    menu: formatMenuForPrompt(availableProducts),
    cart: formatCartForPrompt(cartItems, cartTotal),
    customer: formatCustomerForPrompt(customer),
    history: formatHistoryForPrompt(conversationHistory),
    pendingItems: formatPendingItemsForPrompt(pendingItems)
  };

  console.log('[Context Builder] ✅ All context loaded and formatted');
  console.log('[Context Builder] =============================================\n');

  return {
    // Raw data
    restaurant,
    restaurantAISettings,
    promptOverrides: promptOverrides || [],
    availableProducts,
    conversationHistory,
    activeCart,
    cartItems,
    customer,
    pendingItems,
    conversationState,
    lastShownProducts,
    
    // Computed values
    cartTotal,
    currentState,
    stateMetadata,
    
    // Formatted strings
    formatted
  };
}

// ============================================================
// FORMATTING HELPER FUNCTIONS
// ============================================================

function formatMenuForPrompt(products: any[]): string {
  // Group products by category
  const byCategory: Record<string, any[]> = {};
  products.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });
  
  // Format each category
  const sections = Object.entries(byCategory).map(([category, items]) => {
    const itemsFormatted = items.map(p => {
      // Extract structured metadata from description
      const metadata = extractMetadata(p.description || '');
      const cleanDesc = metadata.cleanDescription;
      
      // Build product line
      let line = `• ${p.name} (ID: ${p.id}) - €${p.price}`;
      if (cleanDesc) line += `\n  📝 ${cleanDesc}`;
      if (metadata.serves) line += `\n  👥 Serve: ${metadata.serves}`;
      if (metadata.profile) line += ` | 🎯 Perfil: ${metadata.profile}`;
      if (metadata.popularity) line += ` | 🔥 Popularidade: ${metadata.popularity}`;
      
      // Add addons
      if (p.addons && p.addons.length > 0) {
        line += `\n  ⭐ ADDONS:`;
        p.addons.forEach((a: any) => {
          line += `\n     → ${a.name} (ID: ${a.id}) - +€${a.price}`;
        });
      }
      
      return line;
    }).join('\n\n');
    
    return `📦 CATEGORIA: ${category}\n\n${itemsFormatted}`;
  }).join('\n\n');
  
  return sections;
}

// Extract structured metadata from product description
function extractMetadata(description: string): {
  cleanDescription: string;
  serves: string | null;
  profile: string | null;
  popularity: string | null;
} {
  let cleanDesc = description;
  let serves = null;
  let profile = null;
  let popularity = null;
  
  // Extract "Serve: X pessoas"
  const servesMatch = description.match(/Serve:\s*([^|]+)/i);
  if (servesMatch) {
    serves = servesMatch[1].trim();
    cleanDesc = cleanDesc.replace(/\|\s*Serve:[^|]+/gi, '');
  }
  
  // Extract "Perfil: X"
  const profileMatch = description.match(/Perfil:\s*([^|]+)/i);
  if (profileMatch) {
    profile = profileMatch[1].trim();
    cleanDesc = cleanDesc.replace(/\|\s*Perfil:[^|]+/gi, '');
  }
  
  // Extract "Popular: X" or "Popularidade: X"
  const popularityMatch = description.match(/Popula(?:r|ridade):\s*([^|]+)/i);
  if (popularityMatch) {
    popularity = popularityMatch[1].trim();
    cleanDesc = cleanDesc.replace(/\|\s*Popula(?:r|ridade):[^|]+/gi, '');
  }
  
  // Clean up any trailing/leading pipes and whitespace
  cleanDesc = cleanDesc.replace(/^\s*\|\s*|\s*\|\s*$/g, '').trim();
  
  return { cleanDescription: cleanDesc, serves, profile, popularity };
}

function formatCartForPrompt(cartItems: any[], cartTotal: number): string {
  if (cartItems.length === 0) return 'Empty cart';
  
  const itemsText = cartItems.map(item => 
    `${item.quantity}x ${item.product_name} (€${item.total_price.toFixed(2)})`
  ).join(', ');
  
  return `${itemsText} | Total: €${cartTotal.toFixed(2)}`;
}

function formatCustomerForPrompt(customer: any | null): string {
  if (!customer) return 'New customer - no saved data';
  
  const parts = [];
  if (customer.name) parts.push(`Name: ${customer.name}`);
  if (customer.default_address) {
    const addr = typeof customer.default_address === 'string' 
      ? customer.default_address 
      : JSON.stringify(customer.default_address);
    parts.push(`Address: ${addr}`);
  }
  if (customer.default_payment_method) parts.push(`Payment: ${customer.default_payment_method}`);
  
  return parts.length > 0 ? parts.join(', ') : 'Customer exists but no saved preferences';
}

function formatHistoryForPrompt(history: any[]): string {
  if (history.length === 0) return 'No previous conversation';
  
  return history.map(msg => 
    `${msg.role === 'user' ? 'Customer' : 'Agent'}: ${msg.content}`
  ).join('\n');
}

function formatPendingItemsForPrompt(pendingItems: any[]): string {
  if (pendingItems.length === 0) return 'No pending items';
  
  return pendingItems
    .filter(item => item && item.product && item.product.name) // Filter out null/invalid items
    .map(item => {
      const addonsText = item.addons && item.addons.length > 0
        ? ` + ${item.addons.map((a: any) => a.name).join(', ')}`
        : '';
      const notesText = item.notes ? ` (${item.notes})` : '';
      return `${item.quantity}x ${item.product.name}${addonsText}${notesText}`;
    }).join(', ');
}
