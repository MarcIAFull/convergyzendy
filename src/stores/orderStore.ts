import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Order, OrderWithDetails, CartItemWithDetails } from '@/types/database';

interface OrderState {
  orders: OrderWithDetails[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchOrders: (restaurantId: string) => Promise<void>;
  updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;
  subscribeToOrders: (restaurantId: string) => () => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  loading: false,
  error: null,

  fetchOrders: async (restaurantId: string) => {
    set({ loading: true, error: null });
    try {
      // Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        set({ orders: [], loading: false });
        return;
      }

      // Fetch cart items for all orders
      const cartIds = orders.map(o => o.cart_id);
      const { data: cartItems, error: cartItemsError } = await supabase
        .from('cart_items')
        .select('*')
        .in('cart_id', cartIds);

      if (cartItemsError) throw cartItemsError;

      // Fetch products
      const productIds = [...new Set(cartItems?.map(ci => ci.product_id) || [])];
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (productsError) throw productsError;

      // Fetch cart item addons
      const cartItemIds = cartItems?.map(ci => ci.id) || [];
      const { data: cartItemAddons, error: cartItemAddonsError } = await supabase
        .from('cart_item_addons')
        .select('*, addons(*)')
        .in('cart_item_id', cartItemIds);

      if (cartItemAddonsError) throw cartItemAddonsError;

      // Build nested structure
      const ordersWithDetails = orders.map(order => {
        const orderCartItems = (cartItems || []).filter(ci => ci.cart_id === order.cart_id);
        
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
        };
      }) as unknown as OrderWithDetails[];

      set({ orders: ordersWithDetails, loading: false });
    } catch (error) {
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
    console.log('Setting up real-time subscription for restaurant:', restaurantId);
    
    const channel = supabase
      .channel('orders-realtime')
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
          // Refetch orders when any change occurs
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
          // Refetch orders when cart items change
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
          // Refetch orders when cart item addons change
          get().fetchOrders(restaurantId);
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates');
        }
      });

    // Return unsubscribe function
    return () => {
      console.log('Unsubscribing from real-time updates');
      supabase.removeChannel(channel);
    };
  },
}));
