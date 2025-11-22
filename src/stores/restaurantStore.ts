import { create } from 'zustand';
import { supabase, waitForAuth } from '@/integrations/supabase/client';
import type { Restaurant } from '@/types/database';

// Retry logic with exponential backoff for RLS race conditions
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 500
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRLSError = error.code === 'PGRST301' || 
                         error.message?.toLowerCase().includes('policy') ||
                         error.message?.toLowerCase().includes('permission');
      
      if (isRLSError && i < maxRetries - 1) {
        const waitTime = delay * (i + 1);
        console.log(`[RetryLogic] 🔄 Attempt ${i + 1} failed with RLS error, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Retry logic failed - should not reach here');
};

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
    console.log('[RestaurantStore] 🔄 Starting fetchRestaurant...');
    set({ loading: true, error: null });
    try {
      // Step 0: Wait for auth to be ready (JWT token available)
      const authReady = await waitForAuth();
      if (!authReady) {
        console.error('[RestaurantStore] ❌ Auth not ready after timeout');
        set({ loading: false, restaurant: null });
        return;
      }

      // Step 1: Get authenticated user with retry
      const { data: { user }, error: userError } = await retryWithBackoff(() => 
        supabase.auth.getUser()
      );
      console.log('[RestaurantStore] 👤 User fetch result:', { 
        userId: user?.id, 
        userEmail: user?.email,
        error: userError?.message 
      });
      
      if (userError) {
        console.error('[RestaurantStore] ❌ User error:', userError);
        set({ restaurant: null, loading: false });
        return;
      }

      if (!user) {
        console.log('[RestaurantStore] ⚠️ No user found - user not authenticated');
        set({ loading: false, restaurant: null });
        return;
      }

      console.log('[RestaurantStore] 🔍 Querying restaurant_owners for user:', user.id);

      // Step 2: Get restaurant via restaurant_owners with retry
      const { data: ownership, error: ownershipError } = await retryWithBackoff(async () => {
        const result = await supabase
          .from('restaurant_owners')
          .select('restaurant_id')
          .eq('user_id', user.id)
          .maybeSingle();
        return result;
      });
      
      console.log('[RestaurantStore] 📊 Ownership query result:', { 
        hasData: !!ownership, 
        restaurantId: ownership?.restaurant_id,
        error: ownershipError?.message,
        errorCode: ownershipError?.code,
        errorDetails: ownershipError?.details
      });

      if (ownershipError) {
        console.error('[RestaurantStore] ❌ Error fetching ownership:', {
          message: ownershipError.message,
          code: ownershipError.code,
          details: ownershipError.details,
          hint: ownershipError.hint
        });
        throw ownershipError;
      }

      if (!ownership) {
        console.log('[RestaurantStore] ⚠️ No restaurant ownership found for user - needs onboarding');
        set({ restaurant: null, loading: false });
        return;
      }

      console.log('[RestaurantStore] 🔍 Fetching restaurant data for ID:', ownership.restaurant_id);

      // Step 3: Fetch restaurant data with retry
      const { data: restaurant, error: restaurantError } = await retryWithBackoff(async () => {
        const result = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', ownership.restaurant_id)
          .single();
        return result;
      });
      
      console.log('[RestaurantStore] 📊 Restaurant query result:', {
        hasData: !!restaurant,
        restaurantName: restaurant?.name,
        error: restaurantError?.message,
        errorCode: restaurantError?.code
      });

      if (restaurantError) {
        console.error('[RestaurantStore] ❌ Error fetching restaurant:', {
          message: restaurantError.message,
          code: restaurantError.code,
          details: restaurantError.details,
          hint: restaurantError.hint
        });
        throw restaurantError;
      }

      console.log('[RestaurantStore] ✅ Restaurant fetched successfully:', {
        id: restaurant.id,
        name: restaurant.name
      });
      set({ restaurant: restaurant as unknown as Restaurant, loading: false });
    } catch (error) {
      console.error('[RestaurantStore] ❌ Fetch restaurant error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : undefined,
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined
      });
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
}));
