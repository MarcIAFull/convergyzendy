import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Subscription = Tables<'subscriptions'>;
type UsageLog = Tables<'usage_logs'>;

interface SubscriptionState {
  subscription: Subscription | null;
  usageLogs: UsageLog[];
  loading: boolean;
  error: string | null;
  
  fetchSubscription: (restaurantId: string) => Promise<void>;
  fetchUsageLogs: (restaurantId: string) => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  subscription: null,
  usageLogs: [],
  loading: false,
  error: null,

  fetchSubscription: async (restaurantId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .single();

      if (error) throw error;
      set({ subscription: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchUsageLogs: async (restaurantId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('usage_logs')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      set({ usageLogs: data || [], loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
}));
