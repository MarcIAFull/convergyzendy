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
    console.log('[RestaurantStore] Fetching restaurant...');
    set({ loading: true, error: null });
    try {
      // For single-tenant MVP, just get the first restaurant
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .limit(1)
        .maybeSingle(); // Use maybeSingle to avoid error when no rows exist

      if (error) {
        console.error('[RestaurantStore] Error fetching restaurant:', error);
        throw error;
      }

      if (!data) {
        console.log('[RestaurantStore] No restaurant found');
        set({ restaurant: null, loading: false });
        return;
      }

      console.log('[RestaurantStore] Restaurant loaded:', data);
      set({ restaurant: data as unknown as Restaurant, loading: false });
    } catch (error) {
      console.error('[RestaurantStore] Failed to fetch restaurant:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch restaurant',
        loading: false 
      });
    }
  },

  createRestaurant: async (restaurantData) => {
    console.log('[RestaurantStore] Creating restaurant:', restaurantData);
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

      if (error) {
        console.error('[RestaurantStore] Error creating restaurant:', error);
        throw error;
      }

      console.log('[RestaurantStore] Restaurant created successfully:', data);
      set({ restaurant: data as unknown as Restaurant, loading: false });
    } catch (error) {
      console.error('[RestaurantStore] Failed to create restaurant:', error);
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
      console.error('[RestaurantStore] No restaurant to update');
      throw new Error('No restaurant to update');
    }

    console.log('[RestaurantStore] Updating restaurant:', restaurant.id, updates);
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .update(updates as any)
        .eq('id', restaurant.id)
        .select()
        .single();

      if (error) {
        console.error('[RestaurantStore] Error updating restaurant:', error);
        throw error;
      }

      console.log('[RestaurantStore] Restaurant updated successfully:', data);
      set({ restaurant: data as unknown as Restaurant, loading: false });
    } catch (error) {
      console.error('[RestaurantStore] Failed to update restaurant:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update restaurant',
        loading: false 
      });
      throw error;
    }
  },

  setRestaurant: (restaurant) => set({ restaurant }),
}));
