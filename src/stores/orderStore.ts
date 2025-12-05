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
  updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;
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
      // Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .abortSignal(signal);

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        set({ orders: [], loading: false });
        return;
      }

      // Check if request was cancelled
      if (signal.aborted) return;

      // Fetch customers for all orders
      const userPhones = [...new Set(orders.map(o => o.user_phone))];
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('phone, name')
        .in('phone', userPhones)
        .eq('restaurant_id', restaurantId)
        .abortSignal(signal);

      if (customersError) throw customersError;
      if (signal.aborted) return;

      // Fetch cart items for all orders
      const cartIds = orders.map(o => o.cart_id);
      const { data: cartItems, error: cartItemsError } = await supabase
        .from('cart_items')
        .select('*')
        .in('cart_id', cartIds)
        .abortSignal(signal);

      if (cartItemsError) throw cartItemsError;
      if (signal.aborted) return;

      // Fetch products
      const productIds = [...new Set(cartItems?.map(ci => ci.product_id) || [])];
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)
        .abortSignal(signal);

      if (productsError) throw productsError;
      if (signal.aborted) return;

      // Fetch cart item addons
      const cartItemIds = cartItems?.map(ci => ci.id) || [];
      const { data: cartItemAddons, error: cartItemAddonsError } = await supabase
        .from('cart_item_addons')
        .select('*, addons(*)')
        .in('cart_item_id', cartItemIds)
        .abortSignal(signal);

      if (cartItemAddonsError) throw cartItemAddonsError;
      if (signal.aborted) return;

      // Build nested structure
      const ordersWithDetails = orders.map(order => {
        const orderCartItems = (cartItems || []).filter(ci => ci.cart_id === order.cart_id);
        const customer = customers?.find(c => c.phone === order.user_phone) || null;
        
        const items: CartItemWithDetails[] = orderCartItems.map(cartItem => {
          const product = products?.find(p => p.id === cartItem.product_id);
          const itemAddons = (cartItemAddons || [])
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
        };
      }) as unknown as OrderWithDetails[];

      set({ orders: ordersWithDetails, loading: false });
    } catch (error) {
      // Ignore abort errors
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

  updateOrderStatus: async (id, status) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      set(state => ({
        orders: state.orders.map(order =>
          order.id === id ? { ...order, status } : order
        ),
        loading: false,
      }));
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
