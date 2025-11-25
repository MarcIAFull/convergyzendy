import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Restaurant = Tables<'restaurants'>;

interface UserRestaurantsState {
  restaurants: Restaurant[];
  loading: boolean;
  error: string | null;
  fetchUserRestaurants: () => Promise<void>;
  clearRestaurants: () => void;
}

export const useUserRestaurantsStore = create<UserRestaurantsState>((set) => ({
  restaurants: [],
  loading: false,
  error: null,

  fetchUserRestaurants: async () => {
    set({ loading: true, error: null });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        set({ restaurants: [], loading: false });
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
        set({ restaurants: restaurants || [], loading: false });
      } else {
        // Regular users only see their assigned restaurants
        const { data: ownerships, error: ownershipsError } = await supabase
          .from('restaurant_owners')
          .select('restaurant_id')
          .eq('user_id', user.id);

        if (ownershipsError) throw ownershipsError;

        if (!ownerships || ownerships.length === 0) {
          set({ restaurants: [], loading: false });
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
        set({ restaurants: restaurants || [], loading: false });
      }

    } catch (error) {
      console.error('[UserRestaurantsStore] Error fetching restaurants:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar restaurantes',
        loading: false 
      });
    }
  },

  clearRestaurants: () => {
    set({ restaurants: [], loading: false, error: null });
  },
}));