import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Category, Product, Addon, AddonGroup, CategoryWithProducts, ProductWithAddons } from '@/types/database';

// AbortController for cancelling in-flight requests
let abortController: AbortController | null = null;

interface MenuState {
  categories: CategoryWithProducts[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchMenu: (restaurantId: string) => Promise<void>;
  reset: () => void;
  
  // Category actions
  addCategory: (name: string, restaurantId: string) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  
  // Product actions
  addProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  duplicateProduct: (productId: string, restaurantId: string) => Promise<void>;
  
  // Addon actions
  addAddon: (addon: Omit<Addon, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateAddon: (id: string, updates: Partial<Addon>) => Promise<void>;
  deleteAddon: (id: string) => Promise<void>;
  
  // Addon Group actions
  addAddonGroup: (group: { product_id: string; name: string; sort_order?: number; min_selections?: number; max_selections?: number | null; free_selections?: number }) => Promise<void>;
  updateAddonGroup: (id: string, updates: Partial<AddonGroup>) => Promise<void>;
  deleteAddonGroup: (id: string) => Promise<void>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  categories: [],
  loading: false,
  error: null,

  reset: () => {
    abortController?.abort();
    abortController = null;
    set({ categories: [], loading: false, error: null });
  },

  fetchMenu: async (restaurantId: string) => {
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    set({ loading: true, error: null });
    try {
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true })
        .abortSignal(signal);

      if (categoriesError) throw categoriesError;
      if (signal.aborted) return;

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .abortSignal(signal);

      if (productsError) throw productsError;
      if (signal.aborted) return;

      const productIds = products?.map(p => p.id) || [];

      // Fetch addons and addon_groups in parallel
      const [addonsResult, groupsResult] = await Promise.all([
        supabase
          .from('addons')
          .select('*')
          .in('product_id', productIds.length > 0 ? productIds : ['__none__'])
          .abortSignal(signal),
        supabase
          .from('addon_groups')
          .select('*')
          .in('product_id', productIds.length > 0 ? productIds : ['__none__'])
          .order('sort_order', { ascending: true })
          .abortSignal(signal),
      ]);

      if (addonsResult.error) throw addonsResult.error;
      if (signal.aborted) return;

      const addons = addonsResult.data || [];
      const addonGroups = (groupsResult.data || []) as unknown as AddonGroup[];

      const categoriesWithProducts: CategoryWithProducts[] = (categories || []).map(category => ({
        ...category,
        products: (products || [])
          .filter(p => p.category_id === category.id)
          .map(product => ({
            ...product,
            addons: addons.filter(a => a.product_id === product.id) as unknown as Addon[],
            addon_groups: addonGroups.filter(g => g.product_id === product.id),
          })),
      }));

      set({ categories: categoriesWithProducts, loading: false });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      set({ error: error instanceof Error ? error.message : 'Failed to fetch menu', loading: false });
    }
  },

  addCategory: async (name, restaurantId) => {
    set({ loading: true, error: null });
    try {
      const { data: existingCategories } = await supabase
        .from('categories')
        .select('sort_order')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const newSortOrder = existingCategories && existingCategories.length > 0 
        ? (existingCategories[0].sort_order || 0) + 1 
        : 0;

      const { error } = await supabase
        .from('categories')
        .insert({ name: name.trim(), restaurant_id: restaurantId, sort_order: newSortOrder })
        .select()
        .single();

      if (error) throw error;
      await get().fetchMenu(restaurantId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add category', loading: false });
      throw error;
    }
  },

  updateCategory: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const sanitizedUpdates = updates.name ? { ...updates, name: updates.name.trim() } : updates;
      const { error } = await supabase.from('categories').update(sanitizedUpdates).eq('id', id);
      if (error) throw error;
      set(state => ({
        categories: state.categories.map(cat => cat.id === id ? { ...cat, ...sanitizedUpdates } : cat),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update category', loading: false });
      throw error;
    }
  },

  deleteCategory: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      set(state => ({
        categories: state.categories.filter(cat => cat.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete category', loading: false });
      throw error;
    }
  },

  addProduct: async (product) => {
    set({ loading: true, error: null });
    try {
      if (!product.name?.trim()) throw new Error('Product name is required');
      if (!product.price || product.price < 0) throw new Error('Valid price is required');

      const { error } = await supabase
        .from('products')
        .insert({
          ...product,
          name: product.name.trim(),
          description: product.description?.trim() || null,
          search_keywords: product.search_keywords || [],
          ingredients: product.ingredients || [],
        })
        .select()
        .single();

      if (error) throw error;
      await get().fetchMenu(product.restaurant_id);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add product', loading: false });
      throw error;
    }
  },

  updateProduct: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const sanitizedUpdates: Record<string, any> = {
        ...updates,
        name: updates.name ? updates.name.trim() : undefined,
        description: updates.description ? updates.description.trim() : updates.description === '' ? null : undefined,
      };
      Object.keys(sanitizedUpdates).forEach(key => {
        if (sanitizedUpdates[key] === undefined && !Array.isArray(sanitizedUpdates[key])) {
          delete sanitizedUpdates[key];
        }
      });

      const { error } = await supabase.from('products').update(sanitizedUpdates).eq('id', id);
      if (error) throw error;

      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.map(prod => prod.id === id ? { ...prod, ...sanitizedUpdates } : prod),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update product', loading: false });
      throw error;
    }
  },

  deleteProduct: async (id) => {
    set({ loading: true, error: null });
    try {
      const state = get();
      const product = state.categories.flatMap(cat => cat.products).find(p => p.id === id);

      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;

      if (product?.image_url) {
        const urlParts = product.image_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        if (fileName) {
          await supabase.storage.from('product-images').remove([fileName]);
        }
      }

      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.filter(prod => prod.id !== id),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete product', loading: false });
      throw error;
    }
  },

  duplicateProduct: async (productId: string, restaurantId: string) => {
    set({ loading: true, error: null });
    try {
      // 1. Get original product
      const { data: original, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();
      if (prodErr || !original) throw new Error('Produto não encontrado');

      // 2. Get original addons
      const { data: originalAddons } = await supabase
        .from('addons')
        .select('*')
        .eq('product_id', productId);

      // 3. Get original addon_groups
      const { data: originalGroups } = await supabase
        .from('addon_groups')
        .select('*')
        .eq('product_id', productId);

      // 4. Insert new product
      const { id: _id, created_at: _ca, updated_at: _ua, ...productData } = original;
      const { data: newProduct, error: insertErr } = await supabase
        .from('products')
        .insert({
          ...productData,
          name: `${original.name} (cópia)`,
        })
        .select()
        .single();
      if (insertErr || !newProduct) throw new Error('Falha ao duplicar produto');

      // 5. Copy addon_groups with ID mapping
      const groupIdMap = new Map<string, string>();
      if (originalGroups && originalGroups.length > 0) {
        for (const group of originalGroups) {
          const { id: _gid, created_at: _gca, updated_at: _gua, product_id: _gpid, ...groupData } = group;
          const { data: newGroup } = await supabase
            .from('addon_groups')
            .insert({ ...groupData, product_id: newProduct.id })
            .select()
            .single();
          if (newGroup) {
            groupIdMap.set(group.id, newGroup.id);
          }
        }
      }

      // 6. Copy addons with mapped group_ids
      if (originalAddons && originalAddons.length > 0) {
        const newAddons = originalAddons.map(addon => ({
          product_id: newProduct.id,
          name: addon.name,
          price: addon.price,
          group_id: addon.group_id ? groupIdMap.get(addon.group_id) || null : null,
        }));
        await supabase.from('addons').insert(newAddons);
      }

      await get().fetchMenu(restaurantId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to duplicate product', loading: false });
      throw error;
    }
  },

  addAddon: async (addon) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.from('addons').insert(addon).select().single();
      if (error) throw error;

      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.map(prod =>
            prod.id === addon.product_id ? { ...prod, addons: [...prod.addons, data as unknown as Addon] } : prod
          ),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add addon', loading: false });
    }
  },

  updateAddon: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.from('addons').update(updates).eq('id', id);
      if (error) throw error;

      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.map(prod => ({
            ...prod,
            addons: prod.addons.map(addon => addon.id === id ? { ...addon, ...updates } : addon),
          })),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update addon', loading: false });
    }
  },

  deleteAddon: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.from('addons').delete().eq('id', id);
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
      set({ error: error instanceof Error ? error.message : 'Failed to delete addon', loading: false });
    }
  },

  addAddonGroup: async (group) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.from('addon_groups').insert(group).select().single();
      if (error) throw error;

      const newGroup = data as unknown as AddonGroup;
      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.map(prod =>
            prod.id === group.product_id
              ? { ...prod, addon_groups: [...(prod.addon_groups || []), newGroup] }
              : prod
          ),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add addon group', loading: false });
    }
  },

  updateAddonGroup: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.from('addon_groups').update(updates).eq('id', id);
      if (error) throw error;

      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.map(prod => ({
            ...prod,
            addon_groups: (prod.addon_groups || []).map(g => g.id === id ? { ...g, ...updates } : g),
          })),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update addon group', loading: false });
    }
  },

  deleteAddonGroup: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.from('addon_groups').delete().eq('id', id);
      if (error) throw error;

      set(state => ({
        categories: state.categories.map(cat => ({
          ...cat,
          products: cat.products.map(prod => ({
            ...prod,
            addon_groups: (prod.addon_groups || []).filter(g => g.id !== id),
            // Addons with this group_id will have group_id set to null by DB CASCADE
            addons: prod.addons.map(a => a.group_id === id ? { ...a, group_id: null } : a),
          })),
        })),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete addon group', loading: false });
    }
  },
}));
