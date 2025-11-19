import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Restaurant } from '@/types/database';

interface RestaurantState {
  restaurant: Restaurant | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchRestaurant: () => Promise<void>;
  createRestaurant: (restaurant: Omit<Restaurant, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<void>;
  updateRestaurant: (updates: Partial<Restaurant>) => Promise<void>;
  setRestaurant: (restaurant: Restaurant | null) => void;
}

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  restaurant: null,
  loading: false,
  error: null,

  fetchRestaurant: async () => {
    set({ loading: true, error: null });
    try {
      // For single-tenant MVP, just get the first restaurant
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        // If no restaurant found, that's ok - just set to null
        if (error.code === 'PGRST116') {
          set({ restaurant: null, loading: false });
          return;
        }
        throw error;
      }

      set({ restaurant: data as unknown as Restaurant, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch restaurant',
        loading: false 
      });
    }
  },

  createRestaurant: async (restaurantData) => {
    set({ loading: true, error: null });
    try {
      // For single-tenant MVP, create without user_id
      const { data, error } = await supabase
        .from('restaurants')
        .insert({
          ...restaurantData,
          user_id: null, // No authentication required
        } as any)
        .select()
        .single();

      if (error) throw error;

      set({ restaurant: data as unknown as Restaurant, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create restaurant',
        loading: false 
      });
      throw error;
    }
  },

  updateRestaurant: async (updates) => {
    const { restaurant } = get();
    if (!restaurant) {
      throw new Error('No restaurant to update');
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .update(updates as any)
        .eq('id', restaurant.id)
        .select()
        .single();

      if (error) throw error;

      set({ restaurant: data as unknown as Restaurant, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update restaurant',
        loading: false 
      });
      throw error;
    }
  },

  setRestaurant: (restaurant) => set({ restaurant }),
}));
