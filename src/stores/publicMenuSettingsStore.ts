import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';

type RestaurantSettings = Tables<'restaurant_settings'>;

interface PublicMenuSettingsState {
  settings: RestaurantSettings | null;
  loading: boolean;
  error: string | null;
  
  fetchSettings: (restaurantId: string) => Promise<void>;
  createSettings: (restaurantId: string, slug: string) => Promise<RestaurantSettings>;
  updateSettings: (id: string, updates: TablesUpdate<'restaurant_settings'>) => Promise<void>;
  uploadImage: (file: File, restaurantId: string, type: 'logo' | 'banner') => Promise<string>;
  checkSlugAvailability: (slug: string, restaurantId: string) => Promise<{ available: boolean; suggestion?: string }>;
  reset: () => void;
}

export const usePublicMenuSettingsStore = create<PublicMenuSettingsState>((set) => ({
  settings: null,
  loading: false,
  error: null,

  fetchSettings: async (restaurantId: string) => {
    set({ loading: true, error: null, settings: null });
    try {
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) throw error;
      set({ settings: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false, settings: null });
    }
  },

  createSettings: async (restaurantId: string, slug: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('restaurant_settings')
        .insert({
          restaurant_id: restaurantId,
          slug: slug,
          menu_enabled: false
        })
        .select()
        .single();

      if (error) throw error;
      set({ settings: data, loading: false });
      return data;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateSettings: async (id: string, updates: TablesUpdate<'restaurant_settings'>) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('restaurant_settings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      set({ settings: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  uploadImage: async (file: File, restaurantId: string, type: 'logo' | 'banner') => {
    const fileExt = file.name.split('.').pop();
    const filePath = `${restaurantId}/${type}.${fileExt}`;

    // Upload com upsert para substituir imagens antigas
    const { error: uploadError } = await supabase.storage
      .from('restaurant-assets')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    // Obter URL pública
    const { data } = supabase.storage
      .from('restaurant-assets')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  checkSlugAvailability: async (slug: string, restaurantId: string) => {
    const { data, error } = await supabase.functions.invoke('check-slug-availability', {
      body: { slug, restaurantId }
    });

    if (error) throw error;
    return data;
  },

  reset: () => {
    console.log('[PublicMenuSettingsStore] 🧹 Store reset');
    set({ settings: null, loading: false, error: null });
  }
}));
