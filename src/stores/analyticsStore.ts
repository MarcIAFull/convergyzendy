import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

interface RecoveryStats {
  total_attempts: number;
  successful_recoveries: number;
  pending_attempts: number;
  failed_attempts: number;
  recovery_rate: number;
  total_recovered_revenue: number;
}

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
  totalCustomers: number;
  conversionRate: number;
  dailyRevenue: DailyRevenue[];
  topProducts: TopProduct[];
  recoveryStats: RecoveryStats;
}

interface AnalyticsState {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  dateRange: 'week' | 'month' | 'all';
  fetchAnalytics: (restaurantId: string, range?: 'week' | 'month' | 'all') => Promise<void>;
  setDateRange: (range: 'week' | 'month' | 'all') => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  dateRange: 'month',

  setDateRange: (range) => set({ dateRange: range }),

  fetchAnalytics: async (restaurantId: string, range = 'month') => {
    set({ loading: true, error: null });
    
    try {
      console.log('[AnalyticsStore] Fetching analytics for restaurant:', restaurantId, 'range:', range);

      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      if (range === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (range === 'month') {
        startDate.setDate(now.getDate() - 30);
      } else {
        // 'all' - get all data (last 365 days max)
        startDate.setDate(now.getDate() - 365);
      }

      // Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          created_at,
          status,
          cart_id
        `)
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (ordersError) throw ordersError;

      // Fetch cart items for top products analysis
      const orderIds = orders?.map(o => o.cart_id) || [];
      const { data: cartItems, error: cartItemsError } = await supabase
        .from('cart_items')
        .select(`
          id,
          cart_id,
          product_id,
          quantity,
          products (
            id,
            name,
            price
          )
        `)
        .in('cart_id', orderIds);

      if (cartItemsError) throw cartItemsError;

      // Fetch total carts (for conversion rate)
      const { count: totalCarts, error: cartsError } = await supabase
        .from('carts')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate.toISOString());

      if (cartsError) throw cartsError;

      // Fetch customer insights
      const { data: customers, error: customersError } = await supabase
        .from('customer_insights')
        .select('phone')
        .gte('last_interaction_at', startDate.toISOString());

      if (customersError) throw customersError;

      // Fetch recovery attempts
      const { data: recoveryAttempts, error: recoveryError } = await supabase
        .from('conversation_recovery_attempts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate.toISOString());

      if (recoveryError) throw recoveryError;

      // Calculate metrics
      const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
      const totalOrders = orders?.length || 0;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const totalCustomers = new Set(customers?.map(c => c.phone) || []).size;
      const conversionRate = totalCarts && totalCarts > 0 ? (totalOrders / totalCarts) * 100 : 0;

      // Calculate daily revenue
      const revenueByDate = new Map<string, { revenue: number; orders: number }>();
      orders?.forEach(order => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        const current = revenueByDate.get(date) || { revenue: 0, orders: 0 };
        revenueByDate.set(date, {
          revenue: current.revenue + Number(order.total_amount),
          orders: current.orders + 1,
        });
      });

      const dailyRevenue: DailyRevenue[] = Array.from(revenueByDate.entries())
        .map(([date, data]) => ({
          date,
          revenue: data.revenue,
          orders: data.orders,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate top products
      const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();
      cartItems?.forEach((item: any) => {
        if (!item.products) return;
        
        const productId = item.product_id;
        const current = productStats.get(productId) || {
          name: item.products.name,
          quantity: 0,
          revenue: 0,
        };
        
        productStats.set(productId, {
          name: current.name,
          quantity: current.quantity + item.quantity,
          revenue: current.revenue + (Number(item.products.price) * item.quantity),
        });
      });

      const topProducts: TopProduct[] = Array.from(productStats.entries())
        .map(([product_id, data]) => ({
          product_id,
          product_name: data.name,
          total_quantity: data.quantity,
          total_revenue: data.revenue,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);

      // Calculate recovery stats
      const totalAttempts = recoveryAttempts?.length || 0;
      const successfulRecoveries = recoveryAttempts?.filter(r => r.status === 'recovered').length || 0;
      const pendingAttempts = recoveryAttempts?.filter(r => r.status === 'pending' || r.status === 'sent').length || 0;
      const failedAttempts = recoveryAttempts?.filter(r => r.status === 'failed').length || 0;
      const recoveryRate = totalAttempts > 0 ? (successfulRecoveries / totalAttempts) * 100 : 0;
      const totalRecoveredRevenue = recoveryAttempts
        ?.filter(r => r.status === 'recovered')
        .reduce((sum, r) => sum + Number(r.cart_value || 0), 0) || 0;

      const recoveryStats: RecoveryStats = {
        total_attempts: totalAttempts,
        successful_recoveries: successfulRecoveries,
        pending_attempts: pendingAttempts,
        failed_attempts: failedAttempts,
        recovery_rate: recoveryRate,
        total_recovered_revenue: totalRecoveredRevenue,
      };

      const analyticsData: AnalyticsData = {
        totalRevenue,
        totalOrders,
        averageTicket,
        totalCustomers,
        conversionRate,
        dailyRevenue,
        topProducts,
        recoveryStats,
      };

      console.log('[AnalyticsStore] Analytics data calculated:', analyticsData);
      set({ data: analyticsData, loading: false });
    } catch (error) {
      console.error('[AnalyticsStore] Error fetching analytics:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch analytics',
        loading: false 
      });
    }
  },
}));
