import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Category, Product, Addon, CategoryWithProducts, ProductWithAddons } from '@/types/database';

interface MenuState {
  categories: CategoryWithProducts[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchMenu: (restaurantId: string) => Promise<void>;
  
  // Category actions
  addCategory: (name: string, restaurantId: string) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  
  // Product actions
  addProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  
  // Addon actions
  addAddon: (addon: Omit<Addon, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateAddon: (id: string, updates: Partial<Addon>) => Promise<void>;
  deleteAddon: (id: string) => Promise<void>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  categories: [],
  loading: false,
  error: null,

  fetchMenu: async (restaurantId: string) => {
    set({ loading: true, error: null });
    try {
      // Fetch categories
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true });

      if (categoriesError) throw categoriesError;

      // Fetch products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (productsError) throw productsError;

      // Fetch addons
      const { data: addons, error: addonsError } = await supabase
        .from('addons')
        .select('*')
        .in('product_id', products?.map(p => p.id) || []);

      if (addonsError) throw addonsError;

      // Build nested structure
      const categoriesWithProducts: CategoryWithProducts[] = (categories || []).map(category => ({
        ...category,
        products: (products || [])
          .filter(p => p.category_id === category.id)
          .map(product => ({
            ...product,
            addons: (addons || []).filter(a => a.product_id === product.id),
          })),
      }));

      set({ categories: categoriesWithProducts, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch menu',
        loading: false 
      });
    }
  },

  addCategory: async (name, restaurantId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, restaurant_id: restaurantId })
        .select()
        .single();

      if (error) throw error;

      await get().fetchMenu(restaurantId);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add category',
        loading: false 
      });
    }
  },

  updateCategory: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Update local state
      set(state => ({
        categories: state.categories.map(cat =>
          cat.id === id ? { ...cat, ...updates } : cat
        ),
        loading: false,
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update category',
        loading: false 
      });
    }
  },

  deleteCategory: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        categories: state.categories.filter(cat => cat.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete category',
        loading: false 
      });
    }
  },

  addProduct: async (product) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();

      if (error) throw error;

      await get().fetchMenu(product.restaurant_id);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add product',
        loading: false 
      });
    }
  },

  updateProduct: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Update local state
      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.map(prod =>
            prod.id === id ? { ...prod, ...updates } : prod
          ),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update product',
        loading: false 
      });
    }
  },

  deleteProduct: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.filter(prod => prod.id !== id),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete product',
        loading: false 
      });
    }
  },

  addAddon: async (addon) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('addons')
        .insert(addon)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.map(prod =>
            prod.id === addon.product_id
              ? { ...prod, addons: [...prod.addons, data] }
              : prod
          ),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add addon',
        loading: false 
      });
    }
  },

  updateAddon: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('addons')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Update local state
      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.map(prod => ({
            ...prod,
            addons: prod.addons.map(addon =>
              addon.id === id ? { ...addon, ...updates } : addon
            ),
          })),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update addon',
        loading: false 
      });
    }
  },

  deleteAddon: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('addons')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.map(prod => ({
            ...prod,
            addons: prod.addons.filter(addon => addon.id !== id),
          })),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete addon',
        loading: false 
      });
    }
  },
}));
