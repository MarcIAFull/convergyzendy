import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { GlovoConfig, GlovoDelivery, GlovoQuote } from '@/types/glovo';

interface GlovoState {
  config: GlovoConfig | null;
  isLoading: boolean;
  error: string | null;
  
  // Delivery state
  currentQuote: GlovoQuote | null;
  deliveries: Record<string, GlovoDelivery>; // keyed by order_id
  
  // Actions
  fetchConfig: (restaurantId: string) => Promise<void>;
  saveConfig: (restaurantId: string, config: Partial<GlovoConfig>) => Promise<void>;
  testConnection: (restaurantId: string) => Promise<boolean>;
  
  // Delivery actions
  getQuote: (restaurantId: string, orderId: string, deliveryAddress: {
    latitude: number;
    longitude: number;
    address: string;
    details?: string;
  }) => Promise<GlovoQuote | null>;
  createDelivery: (restaurantId: string, params: {
    quoteId: string;
    orderId: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: {
      latitude: number;
      longitude: number;
      address: string;
      details?: string;
    };
    orderDescription?: string;
  }) => Promise<GlovoDelivery | null>;
  cancelDelivery: (restaurantId: string, trackingNumber: string, reason?: string) => Promise<boolean>;
  refreshDeliveryStatus: (restaurantId: string, trackingNumber: string) => Promise<void>;
  fetchDeliveryForOrder: (restaurantId: string, orderId: string) => Promise<GlovoDelivery | null>;
  
  clearQuote: () => void;
  clearError: () => void;
  reset: () => void;
}

export const useGlovoStore = create<GlovoState>((set, get) => ({
  config: null,
  isLoading: false,
  error: null,
  currentQuote: null,
  deliveries: {},

  fetchConfig: async (restaurantId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Query without type inference since table is new
      const { data, error } = await supabase
        .from('restaurant_glovo_config')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      set({ config: data as unknown as GlovoConfig | null, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch config';
      set({ error: message, isLoading: false });
    }
  },

  saveConfig: async (restaurantId: string, configUpdate: Partial<GlovoConfig>) => {
    set({ isLoading: true, error: null });
    try {
      const { config } = get();
      
      if (config?.id) {
        // Update existing
        const { error } = await supabase
          .from('restaurant_glovo_config')
          .update({
            ...configUpdate,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', config.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('restaurant_glovo_config')
          .insert({
            restaurant_id: restaurantId,
            ...configUpdate,
          } as any);
        
        if (error) throw error;
      }

      // Refetch
      await get().fetchConfig(restaurantId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save config';
      set({ error: message, isLoading: false });
    }
  },

  testConnection: async (restaurantId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('glovo-auth', {
        body: { action: 'get-token', restaurantId },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      set({ isLoading: false });
      return response.data?.hasValidToken === true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  getQuote: async (restaurantId, orderId, deliveryAddress) => {
    set({ isLoading: true, error: null, currentQuote: null });
    try {
      const response = await supabase.functions.invoke('glovo-delivery', {
        body: {
          action: 'quote',
          restaurantId,
          orderId,
          deliveryAddress,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      const quote: GlovoQuote = {
        quoteId: response.data.quote.quoteId,
        price: response.data.quote.estimatedPrice,
        currency: response.data.quote.currency,
        estimatedPickup: new Date(response.data.quote.estimatedPickupTime),
        estimatedDelivery: new Date(response.data.quote.estimatedDeliveryTime),
        expiresAt: new Date(response.data.quote.expiresAt),
      };

      set({ currentQuote: quote, isLoading: false });
      return quote;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get quote';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  createDelivery: async (restaurantId, params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await supabase.functions.invoke('glovo-delivery', {
        body: {
          action: 'create',
          restaurantId,
          ...params,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      const delivery = response.data.delivery as GlovoDelivery;
      
      set(state => ({
        deliveries: { ...state.deliveries, [params.orderId]: delivery },
        currentQuote: null,
        isLoading: false,
      }));

      return delivery;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create delivery';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  cancelDelivery: async (restaurantId, trackingNumber, reason) => {
    set({ isLoading: true, error: null });
    try {
      const response = await supabase.functions.invoke('glovo-delivery', {
        body: {
          action: 'cancel',
          restaurantId,
          trackingNumber,
          reason,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      set({ isLoading: false });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel delivery';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  refreshDeliveryStatus: async (restaurantId, trackingNumber) => {
    try {
      const response = await supabase.functions.invoke('glovo-delivery', {
        body: {
          action: 'status',
          restaurantId,
          trackingNumber,
        },
      });

      if (response.error || response.data?.error) {
        console.error('Failed to refresh status:', response.error || response.data?.error);
      }
    } catch (error) {
      console.error('Failed to refresh delivery status:', error);
    }
  },

  fetchDeliveryForOrder: async (restaurantId, orderId) => {
    try {
      const response = await supabase.functions.invoke('glovo-delivery', {
        body: {
          action: 'get-delivery',
          restaurantId,
          orderId,
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const delivery = response.data?.delivery as GlovoDelivery | null;
      
      if (delivery) {
        set(state => ({
          deliveries: { ...state.deliveries, [orderId]: delivery },
        }));
      }

      return delivery;
    } catch (error) {
      console.error('Failed to fetch delivery:', error);
      return null;
    }
  },

  clearQuote: () => set({ currentQuote: null }),
  clearError: () => set({ error: null }),
  
  reset: () => set({
    config: null,
    isLoading: false,
    error: null,
    currentQuote: null,
    deliveries: {},
  }),
}));
