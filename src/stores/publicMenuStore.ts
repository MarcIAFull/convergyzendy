import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { PublicMenuData, RestaurantSettings } from '@/types/public-menu';
import { Product, Addon, AddonGroup, Category } from '@/types/database';

interface PublicMenuState {
  menuData: PublicMenuData | null;
  addonGroups: AddonGroup[];
  loading: boolean;
  error: string | null;
  fetchMenuBySlug: (slug: string) => Promise<void>;
}

export const usePublicMenuStore = create<PublicMenuState>((set, get) => ({
  menuData: null,
  addonGroups: [],
  loading: false,
  error: null,

  fetchMenuBySlug: async (slug: string) => {
    const currentState = get();
    if (currentState.loading) return;

    set({ loading: true, error: null });

    try {
      const { data: settings, error: settingsError } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('slug', slug)
        .eq('menu_enabled', true)
        .single();

      if (settingsError || !settings) {
        throw new Error('Menu não encontrado ou não está disponível');
      }

      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', settings.restaurant_id)
        .single();

      if (restaurantError || !restaurant) {
        throw new Error('Restaurante não encontrado');
      }

      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', settings.restaurant_id)
        .order('sort_order', { ascending: true });

      if (categoriesError) throw new Error('Erro ao carregar categorias');

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', settings.restaurant_id)
        .eq('is_available', true)
        .order('display_order', { ascending: true });

      if (productsError) throw new Error('Erro ao carregar produtos');

      const productIds = products?.map((p) => p.id) || [];
      let addons: Addon[] = [];
      let addonGroups: AddonGroup[] = [];

      if (productIds.length > 0) {
        const [addonsResult, groupsResult] = await Promise.all([
          supabase.from('addons').select('*').in('product_id', productIds),
          supabase.from('addon_groups').select('*').in('product_id', productIds).order('sort_order', { ascending: true }),
        ]);

        if (!addonsResult.error) addons = addonsResult.data || [];
        if (!groupsResult.error) addonGroups = (groupsResult.data || []) as unknown as AddonGroup[];
      }

      set({
        menuData: {
          restaurant: restaurant as any,
          settings: settings as RestaurantSettings,
          categories: (categories || []) as any,
          products: (products || []) as any,
          addons: addons as any,
        },
        addonGroups,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Erro ao carregar menu:', error);
      set({
        menuData: null,
        addonGroups: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar menu',
      });
    }
  },
}));
