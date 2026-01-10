import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

interface TokenUsageDaily {
  id: string;
  restaurant_id: string;
  date: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_interactions: number;
  avg_tokens_per_interaction: number;
  estimated_cost_usd: number;
  tokens_by_model: Record<string, number>;
}

interface CurrentPeriodUsage {
  tokensUsed: number;
  tokensLimit: number;
  percentUsed: number;
  estimatedCostUsd: number;
  daysRemaining: number;
  projectedMonthlyTokens: number;
  periodStart: string | null;
  periodEnd: string | null;
}

interface TokenUsageState {
  dailyUsage: TokenUsageDaily[];
  currentPeriod: CurrentPeriodUsage | null;
  todayUsage: { tokens: number; interactions: number; cost: number } | null;
  loading: boolean;
  error: string | null;

  fetchDailyUsage: (restaurantId: string, days?: number) => Promise<void>;
  fetchCurrentPeriod: (restaurantId: string) => Promise<void>;
  fetchTodayUsage: (restaurantId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  dailyUsage: [],
  currentPeriod: null,
  todayUsage: null,
  loading: false,
  error: null,
};

export const useTokenUsageStore = create<TokenUsageState>((set) => ({
  ...initialState,

  fetchDailyUsage: async (restaurantId: string, days = 30) => {
    set({ loading: true, error: null });
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('token_usage_daily')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;

      set({ 
        dailyUsage: (data || []).map(d => ({
          ...d,
          tokens_by_model: (d.tokens_by_model as Record<string, number>) || {}
        })), 
        loading: false 
      });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchCurrentPeriod: async (restaurantId: string) => {
    set({ loading: true, error: null });
    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('tokens_used, tokens_limit, current_period_start, current_period_end')
        .eq('restaurant_id', restaurantId)
        .in('status', ['active', 'trialing'])
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (subscription) {
        const tokensUsed = subscription.tokens_used || 0;
        const tokensLimit = subscription.tokens_limit || 500000;
        const periodEnd = new Date(subscription.current_period_end);
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        
        const periodStart = new Date(subscription.current_period_start);
        const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.max(1, daysInPeriod - daysRemaining);
        const dailyAverage = tokensUsed / daysElapsed;
        const projectedMonthlyTokens = Math.round(dailyAverage * daysInPeriod);

        // Custo estimado GPT-4o mini: 80% input @ $0.15/1M, 20% output @ $0.60/1M
        const estimatedCostUsd = (tokensUsed * 0.8 * 0.15 / 1000000) + (tokensUsed * 0.2 * 0.60 / 1000000);

        set({
          currentPeriod: {
            tokensUsed,
            tokensLimit,
            percentUsed: Math.round((tokensUsed / tokensLimit) * 100),
            estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
            daysRemaining,
            projectedMonthlyTokens,
            periodStart: subscription.current_period_start,
            periodEnd: subscription.current_period_end,
          },
          loading: false,
        });
      } else {
        set({ currentPeriod: null, loading: false });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchTodayUsage: async (restaurantId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('ai_interaction_logs')
        .select('tokens_used')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', `${today}T00:00:00`)
        .not('tokens_used', 'is', null);

      if (error) throw error;

      const tokens = (data || []).reduce((sum, log) => sum + (log.tokens_used || 0), 0);
      const interactions = data?.length || 0;
      // GPT-4o mini: Input $0.15/1M, Output $0.60/1M
      const cost = (tokens * 0.8 * 0.15 / 1000000) + (tokens * 0.2 * 0.60 / 1000000);

      set({
        todayUsage: {
          tokens,
          interactions,
          cost: Math.round(cost * 100) / 100,
        },
      });
    } catch (error: any) {
      console.error('Error fetching today usage:', error);
    }
  },

  reset: () => set(initialState),
}));
