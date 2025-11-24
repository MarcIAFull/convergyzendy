import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type TenantSettings = Tables<'tenant_settings'>;

interface TenantState {
  settings: TenantSettings | null;
  loading: boolean;
  error: string | null;
  
  fetchSettings: (restaurantId: string) => Promise<void>;
  updateSettings: (id: string, updates: TablesUpdate<'tenant_settings'>) => Promise<void>;
  createSettings: (settings: TablesInsert<'tenant_settings'>) => Promise<void>;
}

export const useTenantStore = create<TenantState>((set) => ({
  settings: null,
  loading: false,
  error: null,

  fetchSettings: async (restaurantId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      set({ settings: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  updateSettings: async (id: string, updates: TablesUpdate<'tenant_settings'>) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('tenant_settings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      set({ settings: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createSettings: async (settings: TablesInsert<'tenant_settings'>) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('tenant_settings')
        .insert(settings)
        .select()
        .single();

      if (error) throw error;
      set({ settings: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
}));
