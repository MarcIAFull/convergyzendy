import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Order, OrderWithDetails, CartItemWithDetails } from '@/types/database';

// AbortController for cancelling in-flight requests
let abortController: AbortController | null = null;
// Track active channels for cleanup
let activeChannel: any = null;

interface OrderState {
  orders: OrderWithDetails[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchOrders: (restaurantId: string) => Promise<void>;
  updateOrderStatus: (id: string, status: Order['status'], source?: 'whatsapp' | 'web') => Promise<void>;
  subscribeToOrders: (restaurantId: string) => () => void;
  reset: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  loading: false,
  error: null,

  reset: () => {
    console.log('[OrderStore] 🧹 Resetting store');
    
    // Cancel any in-flight requests
    abortController?.abort();
    abortController = null;
    
    // Remove active channel
    if (activeChannel) {
      supabase.removeChannel(activeChannel);
      activeChannel = null;
    }
    
    set({ 
      orders: [], 
      loading: false, 
      error: null 
    });
  },

  fetchOrders: async (restaurantId: string) => {
    // Cancel previous request if still in progress
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    set({ loading: true, error: null });
    try {
      // Fetch both orders and web_orders in parallel
      const [ordersResult, webOrdersResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false })
          .abortSignal(signal),
        supabase
          .from('web_orders')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false })
          .abortSignal(signal),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (webOrdersResult.error) {
        console.warn('[OrderStore] Failed to fetch web_orders:', webOrdersResult.error);
      }

      const orders = ordersResult.data || [];
      const webOrders = webOrdersResult.data || [];

      if (signal.aborted) return;

      // --- Process regular (WhatsApp) orders ---
      let whatsappOrdersWithDetails: OrderWithDetails[] = [];

      if (orders.length > 0) {
        const userPhones = [...new Set(orders.map(o => o.user_phone))];
        const cartIds = orders.map(o => o.cart_id);

        const [customersResult, cartItemsResult] = await Promise.all([
          supabase
            .from('customers')
            .select('phone, name')
            .in('phone', userPhones)
            .eq('restaurant_id', restaurantId)
            .abortSignal(signal),
          supabase
            .from('cart_items')
            .select('*')
            .in('cart_id', cartIds)
            .abortSignal(signal),
        ]);

        if (customersResult.error) throw customersResult.error;
        if (cartItemsResult.error) throw cartItemsResult.error;
        if (signal.aborted) return;

        const customers = customersResult.data || [];
        const cartItems = cartItemsResult.data || [];

        const productIds = [...new Set(cartItems.map(ci => ci.product_id))];
        const cartItemIds = cartItems.map(ci => ci.id);

        const [productsResult, cartItemAddonsResult] = await Promise.all([
          supabase
            .from('products')
            .select('*')
            .in('id', productIds)
            .abortSignal(signal),
          supabase
            .from('cart_item_addons')
            .select('*, addons(*)')
            .in('cart_item_id', cartItemIds)
            .abortSignal(signal),
        ]);

        if (productsResult.error) throw productsResult.error;
        if (cartItemAddonsResult.error) throw cartItemAddonsResult.error;
        if (signal.aborted) return;

        const products = productsResult.data || [];
        const cartItemAddons = cartItemAddonsResult.data || [];

        whatsappOrdersWithDetails = orders.map(order => {
          const orderCartItems = cartItems.filter(ci => ci.cart_id === order.cart_id);
          const customer = customers.find(c => c.phone === order.user_phone) || null;
          
          const items: CartItemWithDetails[] = orderCartItems.map(cartItem => {
            const product = products.find(p => p.id === cartItem.product_id);
            const itemAddons = cartItemAddons
              .filter(cia => cia.cart_item_id === cartItem.id)
              .map(cia => cia.addons);

            return {
              ...cartItem,
              product: product!,
              addons: itemAddons,
            } as unknown as CartItemWithDetails;
          });

          return {
            ...order,
            items,
            customer,
            source: 'whatsapp' as const,
          };
        }) as unknown as OrderWithDetails[];
      }

      // --- Process web orders ---
      const webOrdersMapped: OrderWithDetails[] = webOrders.map(wo => {
        const woItems = (wo.items as any[]) || [];
        const items: CartItemWithDetails[] = woItems.map((item: any, idx: number) => ({
          id: `${wo.id}-item-${idx}`,
          cart_id: wo.cart_id,
          product_id: item.product_id || '',
          quantity: item.quantity || 1,
          notes: item.notes || null,
          created_at: wo.created_at || '',
          updated_at: wo.updated_at || '',
          product: {
            id: item.product_id || '',
            restaurant_id: wo.restaurant_id,
            category_id: '',
            name: item.product_name || item.name || 'Produto',
            description: null,
            price: item.unit_price || item.price || 0,
            image_url: item.image_url || null,
            is_available: true,
            search_keywords: [],
            ingredients: [],
            max_addons: null,
            free_addons_count: null,
            created_at: '',
            updated_at: '',
          },
          addons: (item.addons || []).map((addon: any) => ({
            id: addon.id || '',
            product_id: item.product_id || '',
            name: addon.name || '',
            price: addon.price || 0,
            created_at: '',
            updated_at: '',
          })),
        }));

        return {
          id: wo.id,
          cart_id: wo.cart_id,
          restaurant_id: wo.restaurant_id,
          user_phone: wo.customer_phone,
          total_amount: wo.total_amount,
          payment_method: wo.payment_method as any,
          delivery_address: wo.delivery_address || '',
          order_notes: wo.delivery_instructions || null,
          status: (wo.status || 'new') as Order['status'],
          created_at: wo.created_at || '',
          updated_at: wo.updated_at || '',
          items,
          customer: { phone: wo.customer_phone, name: wo.customer_name || null },
          source: 'web' as const,
          order_type: wo.order_type || 'delivery',
        } as unknown as OrderWithDetails;
      });

      // Combine and sort by created_at descending
      const allOrders = [...whatsappOrdersWithDetails, ...webOrdersMapped];
      allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      set({ orders: allOrders, loading: false });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[OrderStore] Request aborted');
        return;
      }
      
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch orders',
        loading: false 
      });
    }
  },

  updateOrderStatus: async (id, status, source) => {
    set({ loading: true, error: null });
    try {
      const order = get().orders.find(o => o.id === id);
      const restaurantId = order?.restaurant_id;
      const orderSource = source || (order as any)?.source || 'whatsapp';

      // Update in the correct table
      if (orderSource === 'web') {
        const { error } = await supabase
          .from('web_orders')
          .update({ status })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('orders')
          .update({ status })
          .eq('id', id);
        if (error) throw error;
      }

      // Update local state
      set(state => ({
        orders: state.orders.map(o =>
          o.id === id ? { ...o, status } : o
        ),
        loading: false,
      }));

      // Send WhatsApp status notification in background (don't block UI)
      if (restaurantId && status !== 'new') {
        supabase.functions.invoke('notify-order-status', {
          body: { order_id: id, restaurant_id: restaurantId, new_status: status },
        }).then(({ error: notifyError }) => {
          if (notifyError) {
            console.warn('[OrderStore] Failed to send status notification:', notifyError);
          } else {
            console.log('[OrderStore] Status notification sent for', status);
          }
        });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update order status',
        loading: false 
      });
    }
  },

  subscribeToOrders: (restaurantId: string) => {
    console.log('[OrderStore] Setting up real-time subscription for restaurant:', restaurantId);
    
    // Remove existing channel if any
    if (activeChannel) {
      supabase.removeChannel(activeChannel);
    }
    
    const channel = supabase
      .channel(`orders-realtime-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          console.log('Order change detected:', payload);
          get().fetchOrders(restaurantId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'web_orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          console.log('Web order change detected:', payload);
          get().fetchOrders(restaurantId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cart_items',
        },
        (payload) => {
          console.log('Cart item change detected:', payload);
          get().fetchOrders(restaurantId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cart_item_addons',
        },
        (payload) => {
          console.log('Cart item addon change detected:', payload);
          get().fetchOrders(restaurantId);
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates');
        }
      });

    activeChannel = channel;

    // Return unsubscribe function
    return () => {
      console.log('Unsubscribing from real-time updates');
      supabase.removeChannel(channel);
      if (activeChannel === channel) {
        activeChannel = null;
      }
    };
  },
}));
