/**
 * Unified Context Builder for WhatsApp AI Agent
 * 
 * V3.0 - RAG ARCHITECTURE (Menu + Customer)
 * - Menu: categories only (search_menu for details)
 * - Customer: minimal status (get_customer_history for details)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCustomerInsights } from '../_shared/customerInsights.ts';

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
  customerInsights: any | null;  // RAG: minimal insights for prompt
  pendingItems: any[];
  conversationState: any;
  lastShownProducts: Array<{ id: string; name: string }>;
  
  // Computed values
  cartTotal: number;
  currentState: string;
  stateMetadata: any;
  menuUrl: string;
  
  // Formatted strings (for template variables)
  formatted: {
    menu: string;           // RAG format: categories only
    menuFull: string;       // Full menu (for search_menu tool)
    cart: string;
    customer: string;       // RAG format: minimal status
    history: string;
    pendingItems: string;
    restaurantInfo: string; // Restaurant operational info (phone, address, hours, delivery fee)
    localTime: string;      // Local time based on restaurant timezone
  };
}

/**
 * Build complete conversation context from database
 */
export async function buildConversationContext(
  supabase: any,
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

  // Load restaurant settings for slug and custom domain
  const { data: restaurantSettings } = await supabase
    .from('restaurant_settings')
    .select('slug, custom_domain')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  
  // Build menu URL - use custom domain if configured, otherwise use production domain
  const baseUrl = restaurantSettings?.custom_domain 
    ? `https://${restaurantSettings.custom_domain}`
    : 'https://convergy.agency';
  
  const menuUrl = restaurantSettings?.slug 
    ? `${baseUrl}/menu/${restaurantSettings.slug}` 
    : '';
  console.log(`[Context Builder] Menu URL: ${menuUrl || 'Not configured'}`);

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
      .filter((p: any) => p && p.name && p.id)
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
  // LOAD CONVERSATION HISTORY (OPTIMIZED - Phase 1.2)
  // ============================================================
  
  // OPTIMIZATION: Limit to 5 messages total (3 user + 2 assistant) to reduce tokens
  // This saves ~60% of history tokens while maintaining enough context
  const { data: messageHistory } = await supabase
    .from('messages')
    .select('body, direction, timestamp')
    .eq('restaurant_id', restaurantId)
    .or(`from_number.eq.${customerPhone},to_number.eq.${customerPhone}`)
    .order('timestamp', { ascending: false })
    .limit(10); // Fetch 10, keep 5

  // Separar e limitar mensagens por direção (3 user + 2 assistant = 5 total)
  const inboundMessages = (messageHistory || []).filter((msg: any) => msg.direction === 'inbound').slice(0, 3);
  const outboundMessages = (messageHistory || []).filter((msg: any) => msg.direction === 'outbound').slice(0, 2);
  
  // Combinar e ordenar por timestamp
  const combinedMessages = [...inboundMessages, ...outboundMessages]
    .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = 
    combinedMessages.map((msg: any) => ({
      role: (msg.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.body
    }));

  console.log(`[Context Builder] History: ${conversationHistory.length} messages (${inboundMessages.length} user, ${outboundMessages.length} assistant) [OPTIMIZED]`);

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
      .filter((item: any) => item && item.products && item.products.name)
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
  // LOAD/CREATE CUSTOMER PROFILE (FIX BUG #5)
  // ============================================================
  
  let { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', customerPhone)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  // Auto-create customer profile if not exists
  if (!customer) {
    console.log(`[Context Builder] Creating new customer profile for ${customerPhone}`);
    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert({
        phone: customerPhone,
        restaurant_id: restaurantId,
        metadata: { created_by: 'ai_agent', first_contact: new Date().toISOString() }
      })
      .select()
      .single();
    
    if (!customerError && newCustomer) {
      customer = newCustomer;
      console.log(`[Context Builder] Customer profile created: ${customer.id}`);
    } else {
      console.warn(`[Context Builder] Failed to create customer: ${customerError?.message}`);
    }
  }

  console.log(`[Context Builder] Customer: ${customer ? customer.name || 'Found (no name)' : 'Creation failed'}`);

  // ============================================================
  // LOAD CUSTOMER INSIGHTS (RAG - minimal for prompt)
  // ============================================================
  
  let customerInsights = null;
  try {
    customerInsights = await getCustomerInsights(supabase, customerPhone);
    console.log(`[Context Builder] Customer Insights: ${customerInsights ? `Found (${customerInsights.order_count} orders)` : 'New customer'}`);
  } catch (insightsError) {
    console.warn(`[Context Builder] Failed to load customer insights:`, insightsError);
  }

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
  console.log(`[Context Builder] Last shown products: ${lastShownProducts.length}`);

  // ============================================================
  // FORMAT ALL CONTEXT DATA (RAG OPTIMIZED)
  // ============================================================
  
  const formatted = {
    menu: formatMenuForRAG(availableProducts, menuUrl),           // OPTIMIZED: ~500 chars
    menuFull: formatMenuForPromptFull(availableProducts),         // FULL: for search_menu tool
    cart: formatCartForPrompt(cartItems, cartTotal),
    customer: formatCustomerForRAG(customer, customerInsights),   // RAG: minimal status
    history: formatHistoryForPrompt(conversationHistory),
    pendingItems: formatPendingItemsForPrompt(pendingItems),
    restaurantInfo: formatRestaurantInfoForPrompt(restaurant),    // Operational info
    localTime: ''  // OPTIMIZATION Phase 1.3: Removed - breaks cache, not essential
  };

  console.log(`[Context Builder] ✅ RAG Menu format: ${formatted.menu.length} chars (vs full: ${formatted.menuFull.length} chars)`);
  console.log(`[Context Builder] ✅ RAG Customer format: ${formatted.customer.length} chars`);
  console.log(`[Context Builder] ✅ History format: ${formatted.history.length} chars (${conversationHistory.length} msgs)`);
  console.log(`[Context Builder] 📉 Token reduction: ${Math.round((1 - formatted.menu.length / Math.max(formatted.menuFull.length, 1)) * 100)}%`);
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
    customerInsights,
    pendingItems,
    conversationState,
    lastShownProducts,
    
    // Computed values
    cartTotal,
    currentState,
    stateMetadata,
    menuUrl,
    
    // Formatted strings
    formatted
  };
}

// ============================================================
// RAG FORMATTING FUNCTIONS
// ============================================================

/**
 * RAG-optimized menu format: ONLY categories
 * Reduces prompt from ~56k chars to ~500 chars
 */
function formatMenuForRAG(products: any[], menuUrl: string): string {
  // Extract unique categories
  const categories = [...new Set(
    products
      .filter(p => p && p.category)
      .map(p => p.category)
  )].sort();
  
  // Count products per category
  const categoryCounts = categories.map(cat => {
    const count = products.filter(p => p.category === cat).length;
    return `${cat} (${count})`;
  });
  
  return `📋 CATEGORIAS DISPONÍVEIS:
${categoryCounts.join(' | ')}

⚠️ IMPORTANTE - ARQUITETURA RAG:
• Você NÃO tem o cardápio completo na memória
• Para ver produtos de uma categoria: search_menu(category: "Nome")
• Para buscar item específico: search_menu(query: "nome do produto")
• NUNCA invente produtos ou preços!

${menuUrl ? `🔗 Cardápio online: ${menuUrl}` : ''}`;
}

/**
 * Full menu format (used internally by search_menu tool)
 */
function formatMenuForPromptFull(products: any[]): string {
  // Group products by category
  const byCategory: Record<string, any[]> = {};
  products.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });
  
  // Format each category
  const sections = Object.entries(byCategory).map(([category, items]) => {
    const itemsFormatted = items.map(p => {
      let line = `• ${p.name} (ID: ${p.id}) - €${p.price}`;
      if (p.description) line += ` | ${p.description.substring(0, 50)}`;
      
      // Add addons
      if (p.addons && p.addons.length > 0) {
        const validAddons = (p.addons || []).filter((a: any) => a && a.name);
        if (validAddons.length > 0) {
          line += `\n  Addons: ${validAddons.map((a: any) => `${a.name} (+€${a.price})`).join(', ')}`;
        }
      }
      
      return line;
    }).join('\n');
    
    return `[${category}]\n${itemsFormatted}`;
  }).join('\n\n');
  
  return sections;
}

// ============================================================
// FORMATTING HELPER FUNCTIONS
// ============================================================

function formatCartForPrompt(cartItems: any[], cartTotal: number): string {
  if (cartItems.length === 0) return 'Carrinho vazio';
  
  const itemsText = cartItems.map(item => 
    `${item.quantity}x ${item.product_name} (€${item.total_price.toFixed(2)})`
  ).join(', ');
  
  return `${itemsText} | Total: €${cartTotal.toFixed(2)}`;
}

/**
 * RAG-optimized customer format: minimal status
 * Full history is fetched on-demand via get_customer_history tool
 */
function formatCustomerForRAG(customer: any | null, insights: any | null): string {
  // New customer - no history
  if (!customer && !insights) {
    return '👋 Cliente NOVO - primeira interação';
  }
  
  const parts = [];
  
  // Basic info
  if (customer?.name) parts.push(`Nome: ${customer.name}`);
  if (customer?.default_address) {
    const addr = typeof customer.default_address === 'string' 
      ? customer.default_address 
      : (customer.default_address.formatted || JSON.stringify(customer.default_address));
    parts.push(`📍 ${addr}`);
  }
  if (customer?.default_payment_method) parts.push(`💳 ${customer.default_payment_method}`);
  
  // Minimal insights (RAG mode)
  if (insights && insights.order_count > 0) {
    const status = insights.order_count >= 5 ? '🏆 VIP' : 
                   insights.order_count >= 2 ? '↩️ Retornante' : '👤';
    parts.push(`${status} (${insights.order_count} pedidos)`);
    
    if (insights.average_ticket) {
      parts.push(`Ticket: €${insights.average_ticket.toFixed(2)}`);
    }
  }
  
  // RAG hint
  const hasHistory = insights && insights.order_count > 0;
  const ragHint = hasHistory 
    ? '\n⚡ Para personalizar: get_customer_history()' 
    : '';
  
  return parts.length > 0 
    ? parts.join(' | ') + ragHint
    : 'Cliente existe mas sem preferências salvas' + ragHint;
}

// Keep old function for backwards compatibility
function formatCustomerForPrompt(customer: any | null): string {
  return formatCustomerForRAG(customer, null);
}

/**
 * OPTIMIZED: Ultra-compact history format (Phase 3)
 * Uses arrows instead of labels, truncates long messages
 */
function formatHistoryForPrompt(history: any[]): string {
  if (history.length === 0) return 'Sem conversa anterior';
  
  // Ultra-compact format: → for client, ← for agent
  // Truncate messages > 80 chars to save tokens
  return history.map(msg => {
    const prefix = msg.role === 'user' ? '→' : '←';
    const content = msg.content.length > 80 
      ? msg.content.substring(0, 77) + '...' 
      : msg.content;
    return `${prefix} ${content}`;
  }).join('\n');
}

function formatPendingItemsForPrompt(pendingItems: any[]): string {
  if (pendingItems.length === 0) return 'Nenhum item pendente';
  
  return pendingItems
    .filter(item => item && item.product && item.product.name)
    .map(item => {
      const validAddons = (item.addons || []).filter((a: any) => a && a.name);
      const addonsText = validAddons.length > 0
        ? ` + ${validAddons.map((a: any) => a.name).join(', ')}`
        : '';
      const notesText = item.notes ? ` (${item.notes})` : '';
      return `${item.quantity}x ${item.product.name}${addonsText}${notesText}`;
    }).join(', ');
}

/**
 * Format restaurant operational info for prompt
 * Includes: phone, address, delivery fee, opening hours
 */
function formatRestaurantInfoForPrompt(restaurant: any): string {
  if (!restaurant) return 'Informações do restaurante não disponíveis';
  
  // Format opening hours
  let hoursText = 'Não definido';
  if (restaurant.opening_hours) {
    const days: Record<string, string> = {
      monday: 'Segunda',
      tuesday: 'Terça',
      wednesday: 'Quarta',
      thursday: 'Quinta',
      friday: 'Sexta',
      saturday: 'Sábado',
      sunday: 'Domingo'
    };
    
    const hours = restaurant.opening_hours;
    const formattedHours = Object.entries(days)
      .map(([key, label]) => {
        const dayHours = hours[key];
        if (!dayHours || (!dayHours.open && !dayHours.close)) {
          return `${label}: Fechado`;
        }
        return `${label}: ${dayHours.open || '?'} - ${dayHours.close || '?'}`;
      })
      .join(' | ');
    hoursText = formattedHours;
  }
  
  return `📍 DADOS DO RESTAURANTE:
• Nome: ${restaurant.name}
• Telefone: ${restaurant.phone || 'Não informado'}
• Endereço: ${restaurant.address || 'Não informado'}
• Taxa de Entrega Fixa: €${restaurant.delivery_fee?.toFixed(2) || '0.00'}
• Status: ${restaurant.is_open ? '🟢 Aberto' : '🔴 Fechado'}
• Horários: ${hoursText}`;
}

/**
 * Detect timezone based on restaurant address
 * Defaults to Europe/Lisbon for Portuguese restaurants
 */
function detectTimezone(restaurant: any): string {
  if (!restaurant?.address) return 'Europe/Lisbon';
  
  const address = restaurant.address.toLowerCase();
  
  // Portugal detection
  if (address.includes('portugal') || address.includes('lisboa') || 
      address.includes('porto') || address.includes('pt-') ||
      address.includes('faro') || address.includes('coimbra')) {
    return 'Europe/Lisbon';
  }
  
  // Spain detection
  if (address.includes('españa') || address.includes('spain') || 
      address.includes('madrid') || address.includes('barcelona')) {
    return 'Europe/Madrid';
  }
  
  // Brazil detection
  if (address.includes('brasil') || address.includes('brazil') ||
      address.includes('são paulo') || address.includes('rio de janeiro')) {
    return 'America/Sao_Paulo';
  }
  
  // UK detection  
  if (address.includes('uk') || address.includes('united kingdom') ||
      address.includes('london') || address.includes('england')) {
    return 'Europe/London';
  }
  
  // Default to Portugal
  return 'Europe/Lisbon';
}

/**
 * Format local time for prompt based on restaurant timezone
 */
function formatLocalTimeForPrompt(restaurant: any): string {
  const timezone = detectTimezone(restaurant);
  const now = new Date();
  
  try {
    const formatter = new Intl.DateTimeFormat('pt-PT', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    
    const weekday = getPart('weekday');
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');
    
    return `🕐 ${weekday}, ${day} de ${month} de ${year}, ${hour}:${minute} (${timezone})`;
  } catch (e) {
    // Fallback to simple format
    return `🕐 ${now.toISOString()} (UTC)`;
  }
}
