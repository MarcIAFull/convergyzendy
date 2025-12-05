import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Restaurant = Tables<'restaurants'>;

interface UserRestaurantsState {
  restaurants: Restaurant[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  fetchUserRestaurants: () => Promise<void>;
  addRestaurant: (restaurant: Restaurant) => void;
  clearRestaurants: () => void;
  invalidateAndRefetch: () => Promise<void>;
}

const CACHE_TTL_MS = 30000; // 30 seconds

export const useUserRestaurantsStore = create<UserRestaurantsState>((set, get) => ({
  restaurants: [],
  loading: false,
  error: null,
  lastFetchedAt: null,

  fetchUserRestaurants: async () => {
    // Skip if recently fetched (within cache TTL)
    const { lastFetchedAt, loading } = get();
    if (loading) return;
    
    const now = Date.now();
    if (lastFetchedAt && (now - lastFetchedAt) < CACHE_TTL_MS) {
      console.log('[UserRestaurantsStore] Using cached data');
      return;
    }

    set({ loading: true, error: null });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        set({ restaurants: [], loading: false, lastFetchedAt: now });
        return;
      }

      // Check if user is admin
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      const isAdmin = !!userRole;

      if (isAdmin) {
        // Admins have access to ALL restaurants
        const { data: restaurants, error: restaurantsError } = await supabase
          .from('restaurants')
          .select('*')
          .order('name');

        if (restaurantsError) throw restaurantsError;

        console.log('[UserRestaurantsStore] Admin - Loaded ALL restaurants:', restaurants?.length || 0);
        set({ restaurants: restaurants || [], loading: false, lastFetchedAt: now });
      } else {
        // Regular users only see their assigned restaurants
        const { data: ownerships, error: ownershipsError } = await supabase
          .from('restaurant_owners')
          .select('restaurant_id')
          .eq('user_id', user.id);

        if (ownershipsError) throw ownershipsError;

        if (!ownerships || ownerships.length === 0) {
          set({ restaurants: [], loading: false, lastFetchedAt: now });
          return;
        }

        const restaurantIds = ownerships.map(o => o.restaurant_id);

        const { data: restaurants, error: restaurantsError } = await supabase
          .from('restaurants')
          .select('*')
          .in('id', restaurantIds)
          .order('name');

        if (restaurantsError) throw restaurantsError;

        console.log('[UserRestaurantsStore] User - Loaded restaurants:', restaurants?.length || 0);
        set({ restaurants: restaurants || [], loading: false, lastFetchedAt: now });
      }

    } catch (error) {
      console.error('[UserRestaurantsStore] Error fetching restaurants:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar restaurantes',
        loading: false 
      });
    }
  },

  addRestaurant: (restaurant: Restaurant) => {
    set(state => {
      // Avoid duplicates
      const exists = state.restaurants.some(r => r.id === restaurant.id);
      if (exists) {
        console.log('[UserRestaurantsStore] Restaurant already in list:', restaurant.name);
        return state;
      }
      console.log('[UserRestaurantsStore] Added restaurant locally:', restaurant.name);
      return {
        restaurants: [...state.restaurants, restaurant]
      };
    });
  },

  clearRestaurants: () => {
    set({ restaurants: [], loading: false, error: null, lastFetchedAt: null });
  },

  invalidateAndRefetch: async () => {
    console.log('[UserRestaurantsStore] Invalidating cache and refetching');
    set({ lastFetchedAt: null, restaurants: [] });
    await get().fetchUserRestaurants();
  },
}));
