import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { PublicMenuData, RestaurantSettings } from '@/types/public-menu';
import { Product, Addon, Category } from '@/types/database';

interface PublicMenuState {
  menuData: PublicMenuData | null;
  loading: boolean;
  error: string | null;
  fetchMenuBySlug: (slug: string) => Promise<void>;
}

export const usePublicMenuStore = create<PublicMenuState>((set) => ({
  menuData: null,
  loading: false,
  error: null,

  fetchMenuBySlug: async (slug: string) => {
    set({ loading: true, error: null });

    try {
      // 1. Buscar restaurant_settings por slug
      const { data: settings, error: settingsError } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('slug', slug)
        .eq('menu_enabled', true)
        .single();

      if (settingsError || !settings) {
        throw new Error('Menu não encontrado ou não está disponível');
      }

      // 2. Buscar dados do restaurante
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', settings.restaurant_id)
        .single();

      if (restaurantError || !restaurant) {
        throw new Error('Restaurante não encontrado');
      }

      // 3. Buscar categorias
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', settings.restaurant_id)
        .order('sort_order', { ascending: true });

      if (categoriesError) {
        throw new Error('Erro ao carregar categorias');
      }

      // 4. Buscar produtos disponíveis
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', settings.restaurant_id)
        .eq('is_available', true)
        .order('display_order', { ascending: true });

      if (productsError) {
        throw new Error('Erro ao carregar produtos');
      }

      // 5. Buscar todos os addons dos produtos
      const productIds = products?.map((p) => p.id) || [];
      let addons: Addon[] = [];

      if (productIds.length > 0) {
        const { data: addonsData, error: addonsError } = await supabase
          .from('addons')
          .select('*')
          .in('product_id', productIds);

        if (addonsError) {
          console.error('Erro ao carregar addons:', addonsError);
        } else {
          addons = addonsData || [];
        }
      }

      set({
        menuData: {
          restaurant: restaurant as any,
          settings: settings as RestaurantSettings,
          categories: (categories || []) as any,
          products: (products || []) as any,
          addons: addons as any,
        },
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Erro ao carregar menu:', error);
      set({
        menuData: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar menu',
      });
    }
  },
}));
