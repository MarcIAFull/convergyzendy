import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

interface CustomerWithInsights {
  phone: string;
  name: string | null;
  order_count: number;
  average_ticket: number;
  total_spent: number;
  last_interaction_at: string | null;
  last_order_id: string | null;
  order_frequency_days: number | null;
  preferred_items: any[];
  preferred_addons: any[];
  rejected_items: any[];
  notes: string | null;
}

interface CustomerOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  payment_method: string;
  delivery_address: string;
  items: Array<{
    product_name: string;
    quantity: number;
    price: number;
  }>;
}

interface CustomerRecoveryAttempt {
  id: string;
  created_at: string;
  recovery_type: string;
  status: string;
  message_sent: string | null;
  cart_value: number | null;
  items_count: number | null;
}

interface CustomersState {
  customers: CustomerWithInsights[];
  selectedCustomer: CustomerWithInsights | null;
  customerOrders: CustomerOrder[];
  customerRecoveryAttempts: CustomerRecoveryAttempt[];
  loading: boolean;
  loadingOrders: boolean;
  error: string | null;
  filter: 'all' | 'frequent' | 'inactive' | 'high_value';
  fetchCustomers: (restaurantId: string) => Promise<void>;
  fetchCustomerDetails: (phone: string, restaurantId: string) => Promise<void>;
  setFilter: (filter: 'all' | 'frequent' | 'inactive' | 'high_value') => void;
  clearSelectedCustomer: () => void;
}

export const useCustomersStore = create<CustomersState>((set, get) => ({
  customers: [],
  selectedCustomer: null,
  customerOrders: [],
  customerRecoveryAttempts: [],
  loading: false,
  loadingOrders: false,
  error: null,
  filter: 'all',

  setFilter: (filter) => set({ filter }),
  clearSelectedCustomer: () => set({ selectedCustomer: null, customerOrders: [], customerRecoveryAttempts: [] }),

  fetchCustomers: async (restaurantId: string) => {
    set({ loading: true, error: null });
    
    try {
      console.log('[CustomersStore] Fetching customers for restaurant:', restaurantId);

      // Fetch all orders to get unique customers
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('user_phone, total_amount, created_at, id')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch customer insights
      const uniquePhones = [...new Set(orders?.map(o => o.user_phone) || [])];
      
      const { data: insights, error: insightsError } = await supabase
        .from('customer_insights')
        .select('*')
        .in('phone', uniquePhones);

      if (insightsError) throw insightsError;

      // Fetch customer names from customers table
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('phone, name')
        .eq('restaurant_id', restaurantId);

      if (customersError) throw customersError;

      const customerNamesMap = new Map(
        customersData?.map(c => [c.phone, c.name]) || []
      );

      // Combine data
      const insightsMap = new Map(
        insights?.map(i => [i.phone, i]) || []
      );

      const customersWithInsights: CustomerWithInsights[] = uniquePhones.map(phone => {
        const insight = insightsMap.get(phone);
        const customerOrders = orders?.filter(o => o.user_phone === phone) || [];
        const totalSpent = customerOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
        const orderCount = customerOrders.length;
        const avgTicket = orderCount > 0 ? totalSpent / orderCount : 0;

        return {
          phone,
          name: customerNamesMap.get(phone) || null,
          order_count: insight?.order_count || orderCount,
          average_ticket: insight?.average_ticket ? Number(insight.average_ticket) : avgTicket,
          total_spent: totalSpent,
          last_interaction_at: insight?.last_interaction_at || (customerOrders[0]?.created_at || null),
          last_order_id: insight?.last_order_id || null,
          order_frequency_days: insight?.order_frequency_days || null,
          preferred_items: Array.isArray(insight?.preferred_items) ? insight.preferred_items : [],
          preferred_addons: Array.isArray(insight?.preferred_addons) ? insight.preferred_addons : [],
          rejected_items: Array.isArray(insight?.rejected_items) ? insight.rejected_items : [],
          notes: insight?.notes || null,
        };
      });

      // Sort by total spent
      customersWithInsights.sort((a, b) => b.total_spent - a.total_spent);

      console.log('[CustomersStore] Fetched customers:', customersWithInsights.length);
      set({ customers: customersWithInsights, loading: false });
    } catch (error) {
      console.error('[CustomersStore] Error fetching customers:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch customers',
        loading: false 
      });
    }
  },

  fetchCustomerDetails: async (phone: string, restaurantId: string) => {
    set({ loadingOrders: true });
    
    try {
      console.log('[CustomersStore] Fetching details for customer:', phone);

      // Find selected customer
      const selectedCustomer = get().customers.find(c => c.phone === phone);
      if (selectedCustomer) {
        set({ selectedCustomer });
      }

      // Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          total_amount,
          status,
          payment_method,
          delivery_address,
          cart_id
        `)
        .eq('restaurant_id', restaurantId)
        .eq('user_phone', phone)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch cart items for each order
      const orderIds = orders?.map(o => o.cart_id) || [];
      const { data: cartItems, error: cartItemsError } = await supabase
        .from('cart_items')
        .select(`
          cart_id,
          quantity,
          products (
            name,
            price
          )
        `)
        .in('cart_id', orderIds);

      if (cartItemsError) throw cartItemsError;

      // Group cart items by cart_id
      const itemsByCart = new Map<string, any[]>();
      cartItems?.forEach((item: any) => {
        if (!itemsByCart.has(item.cart_id)) {
          itemsByCart.set(item.cart_id, []);
        }
        itemsByCart.get(item.cart_id)?.push({
          product_name: item.products?.name || 'Unknown',
          quantity: item.quantity,
          price: Number(item.products?.price || 0),
        });
      });

      // Combine orders with items
      const customerOrders: CustomerOrder[] = orders?.map(order => ({
        id: order.id,
        created_at: order.created_at,
        total_amount: Number(order.total_amount),
        status: order.status,
        payment_method: order.payment_method,
        delivery_address: order.delivery_address,
        items: itemsByCart.get(order.cart_id) || [],
      })) || [];

      // Fetch recovery attempts
      const { data: recoveryAttempts, error: recoveryError } = await supabase
        .from('conversation_recovery_attempts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('user_phone', phone)
        .order('created_at', { ascending: false });

      if (recoveryError) throw recoveryError;

      const customerRecoveryAttempts: CustomerRecoveryAttempt[] = recoveryAttempts?.map(r => ({
        id: r.id,
        created_at: r.created_at || '',
        recovery_type: r.recovery_type,
        status: r.status || 'pending',
        message_sent: r.message_sent,
        cart_value: r.cart_value ? Number(r.cart_value) : null,
        items_count: r.items_count,
      })) || [];

      console.log('[CustomersStore] Fetched customer details:', {
        orders: customerOrders.length,
        recoveryAttempts: customerRecoveryAttempts.length,
      });

      set({ 
        customerOrders,
        customerRecoveryAttempts,
        loadingOrders: false 
      });
    } catch (error) {
      console.error('[CustomersStore] Error fetching customer details:', error);
      set({ loadingOrders: false });
    }
  },
}));
