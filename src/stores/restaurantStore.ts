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
  clearRestaurant: () => void;
}

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  restaurant: null,
  loading: false,
  error: null,

  fetchRestaurant: async () => {
    console.log('[RestaurantStore] 🔄 Starting fetchRestaurant...');
    set({ loading: true, error: null });
    try {
      // Get authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('[RestaurantStore] ❌ No authenticated user');
        set({ restaurant: null, loading: false });
        return;
      }

      console.log('[RestaurantStore] 🔍 Fetching restaurant for user:', user.id);

      // Get restaurant via restaurant_owners
      const { data: ownership, error: ownershipError } = await supabase
        .from('restaurant_owners')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (ownershipError) {
        console.error('[RestaurantStore] ❌ Ownership query error:', ownershipError);
        throw ownershipError;
      }

      if (!ownership) {
        console.log('[RestaurantStore] ⚠️ No restaurant ownership found');
        set({ restaurant: null, loading: false });
        return;
      }

      // Fetch restaurant data
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', ownership.restaurant_id)
        .single();

      if (restaurantError) {
        console.error('[RestaurantStore] ❌ Restaurant query error:', restaurantError);
        throw restaurantError;
      }

      console.log('[RestaurantStore] ✅ Restaurant loaded:', restaurant.name);
      set({ restaurant: restaurant as unknown as Restaurant, loading: false });
    } catch (error) {
      console.error('[RestaurantStore] ❌ Fetch failed:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch restaurant',
        loading: false 
      });
      throw error;
    }
  },

  createRestaurant: async (restaurantData) => {
    console.log('[RestaurantStore] Creating restaurant:', restaurantData);
    set({ loading: true, error: null });
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User must be authenticated to create a restaurant');
      }

      // Create restaurant with user_id
      const { data, error } = await supabase
        .from('restaurants')
        .insert({
          ...restaurantData,
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[RestaurantStore] Error creating restaurant:', error);
        throw error;
      }

      // Create restaurant_owners entry
      const { error: ownershipError } = await supabase
        .from('restaurant_owners')
        .insert({
          restaurant_id: data.id,
          user_id: user.id,
          role: 'owner'
        });

      if (ownershipError) {
        console.error('[RestaurantStore] Error creating ownership:', ownershipError);
        throw ownershipError;
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

  clearRestaurant: () => {
    console.log('[RestaurantStore] 🧹 Clearing restaurant state');
    set({ 
      restaurant: null, 
      loading: false, 
      error: null 
    });
  },
}));
