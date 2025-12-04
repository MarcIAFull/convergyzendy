import { create } from 'zustand';
import { supabase, ensureValidSession, verifyAuthUid } from '@/integrations/supabase/client';
import type { Restaurant } from '@/types/database';

const STORAGE_KEY = 'zendy_active_restaurant';

interface RestaurantState {
  restaurant: Restaurant | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchRestaurant: () => Promise<void>;
  createRestaurant: (restaurant: Omit<Restaurant, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<Restaurant>;
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
    
    // Try to load from localStorage first
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      console.log('[RestaurantStore] 📦 Found saved restaurant ID:', savedId);
      try {
        const { data: savedRestaurant } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', savedId)
          .single();
        
        if (savedRestaurant) {
          console.log('[RestaurantStore] ✅ Loaded saved restaurant:', savedRestaurant.name);
          set({ restaurant: savedRestaurant as unknown as Restaurant, loading: false });
          return;
        } else {
          console.log('[RestaurantStore] ⚠️ Saved restaurant not found, clearing localStorage');
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.error('[RestaurantStore] ⚠️ Error loading saved restaurant:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    
    try {
      // Get authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('[RestaurantStore] ❌ No authenticated user');
        set({ restaurant: null, loading: false });
        return;
      }

      console.log('[RestaurantStore] 🔍 Fetching restaurants for user:', user.id);

      // Check if user is a global admin
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      let ownerships;
      let ownershipError;

      if (adminRole) {
        // Admin can access any restaurant - get first restaurant
        console.log('[RestaurantStore] 👑 User is admin - fetching first restaurant');
        const { data: allRestaurants, error } = await supabase
          .from('restaurants')
          .select('id')
          .limit(1);
        
        ownershipError = error;
        ownerships = allRestaurants?.map(r => ({ restaurant_id: r.id }));
      } else {
        // Regular user - get their owned restaurants
        const result = await supabase
          .from('restaurant_owners')
          .select('restaurant_id')
          .eq('user_id', user.id);
        
        ownerships = result.data;
        ownershipError = result.error;
      }

      if (ownershipError) {
        console.error('[RestaurantStore] ❌ Ownership query error:', ownershipError);
        throw ownershipError;
      }

      if (!ownerships || ownerships.length === 0) {
        console.log('[RestaurantStore] ⚠️ No restaurant ownership found');
        set({ restaurant: null, loading: false });
        return;
      }

      // Use the first restaurant as default
      const firstOwnership = ownerships[0];

      // Fetch restaurant data
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', firstOwnership.restaurant_id)
        .single();

      if (restaurantError) {
        console.error('[RestaurantStore] ❌ Restaurant query error:', restaurantError);
        throw restaurantError;
      }

      console.log('[RestaurantStore] ✅ Restaurant loaded:', restaurant.name);
      localStorage.setItem(STORAGE_KEY, restaurant.id);
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
      // Ensure valid session before creating
      const sessionValid = await ensureValidSession();
      if (!sessionValid) {
        const { valid } = await verifyAuthUid();
        if (!valid) {
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }
      }

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
      
      // Return the created restaurant for immediate use
      return data as unknown as Restaurant;
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
      // Ensure valid session before updating
      const sessionValid = await ensureValidSession();
      if (!sessionValid) {
        const { valid } = await verifyAuthUid();
        if (!valid) {
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }
      }
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

  setRestaurant: (restaurant) => {
    if (restaurant?.id) {
      localStorage.setItem(STORAGE_KEY, restaurant.id);
    }
    set({ restaurant });
  },

  clearRestaurant: () => {
    console.log('[RestaurantStore] 🧹 Clearing restaurant state');
    localStorage.removeItem(STORAGE_KEY);
    set({ 
      restaurant: null, 
      loading: false, 
      error: null 
    });
  },
}));
