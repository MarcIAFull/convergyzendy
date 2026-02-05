import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { ZoneSoftConfig, ZoneSoftProductMapping, ZoneSoftSyncLog, ZoneSoftProduct } from '@/types/zonesoft';

interface ZoneSoftState {
  config: ZoneSoftConfig | null;
  mappings: ZoneSoftProductMapping[];
  syncLogs: ZoneSoftSyncLog[];
  zoneSoftProducts: ZoneSoftProduct[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  
  // Actions
  fetchConfig: (restaurantId: string) => Promise<void>;
  saveConfig: (restaurantId: string, config: Partial<ZoneSoftConfig>) => Promise<boolean>;
  testConnection: (restaurantId: string) => Promise<{ success: boolean; error?: string; debug?: { url: string; bodyPreview: string; signatureVariantsTried: string[]; storeId: number | null; clientIdPreview: string } }>;
  syncProducts: (restaurantId: string) => Promise<{ success: boolean; products?: ZoneSoftProduct[]; error?: string }>;
  sendOrderToZoneSoft: (restaurantId: string, orderId: string) => Promise<{ success: boolean; documentNumber?: number; error?: string }>;
  fetchMappings: (restaurantId: string) => Promise<void>;
  saveMapping: (restaurantId: string, localProductId: string, zoneSoftProduct: ZoneSoftProduct) => Promise<boolean>;
  fetchSyncLogs: (restaurantId: string, orderId?: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useZoneSoftStore = create<ZoneSoftState>((set, get) => ({
  config: null,
  mappings: [],
  syncLogs: [],
  zoneSoftProducts: [],
  isLoading: false,
  isSyncing: false,
  error: null,
  
  fetchConfig: async (restaurantId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase.functions.invoke('zonesoft-api', {
        body: { action: 'get-config', restaurantId },
      });
      
      if (error) throw error;
      
      set({ config: data.data, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch ZoneSoft config:', error);
      set({ error: 'Falha ao carregar configuração', isLoading: false });
    }
  },
  
  saveConfig: async (restaurantId: string, config: Partial<ZoneSoftConfig>) => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase.functions.invoke('zonesoft-api', {
        body: { action: 'save-config', restaurantId, config },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      set({ config: data.data, isLoading: false });
      return true;
    } catch (error) {
      console.error('Failed to save ZoneSoft config:', error);
      set({ error: 'Falha ao guardar configuração', isLoading: false });
      return false;
    }
  },
  
  testConnection: async (restaurantId: string) => {
    set({ isSyncing: true, error: null });
    
    try {
      const { data, error } = await supabase.functions.invoke('zonesoft-api', {
        body: { action: 'test-connection', restaurantId },
      });
      
      if (error) throw error;
      
      set({ isSyncing: false });
      
      if (data.success) {
        return { success: true };
      } else {
        return { success: false, error: data.error, debug: data.debug };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro de conexão';
      set({ error: errorMessage, isSyncing: false });
      return { success: false, error: errorMessage };
    }
  },
  
  syncProducts: async (restaurantId: string) => {
    set({ isSyncing: true, error: null });
    
    try {
      const { data, error } = await supabase.functions.invoke('zonesoft-api', {
        body: { action: 'sync-products', restaurantId },
      });
      
      if (error) throw error;
      
      if (data.success) {
        const products = data.data?.products || [];
        set({ zoneSoftProducts: products, isSyncing: false });
        
        // Refresh config to get updated products_synced_at
        get().fetchConfig(restaurantId);
        
        return { success: true, products };
      } else {
        set({ isSyncing: false });
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao sincronizar produtos';
      set({ error: errorMessage, isSyncing: false });
      return { success: false, error: errorMessage };
    }
  },
  
  sendOrderToZoneSoft: async (restaurantId: string, orderId: string) => {
    set({ isSyncing: true, error: null });
    
    try {
      const { data, error } = await supabase.functions.invoke('zonesoft-api', {
        body: { action: 'send-order', restaurantId, orderId },
      });
      
      if (error) throw error;
      
      set({ isSyncing: false });
      
      if (data.success) {
        const documentNumber = data.data?.document?.[0]?.numero;
        return { success: true, documentNumber };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar pedido';
      set({ error: errorMessage, isSyncing: false });
      return { success: false, error: errorMessage };
    }
  },
  
  fetchMappings: async (restaurantId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('zonesoft-api', {
        body: { action: 'get-mappings', restaurantId },
      });
      
      if (error) throw error;
      
      set({ mappings: data.data || [] });
    } catch (error) {
      console.error('Failed to fetch mappings:', error);
    }
  },
  
  saveMapping: async (restaurantId: string, localProductId: string, zoneSoftProduct: ZoneSoftProduct) => {
    try {
      const { data, error } = await supabase.functions.invoke('zonesoft-api', {
        body: {
          action: 'save-mapping',
          restaurantId,
          localProductId,
          zoneSoftProductId: zoneSoftProduct.codigo,
          zoneSoftProductCode: zoneSoftProduct.codigo.toString(),
          zoneSoftProductName: zoneSoftProduct.descricao,
        },
      });
      
      if (error) throw error;
      
      // Refresh mappings
      get().fetchMappings(restaurantId);
      
      return data.success;
    } catch (error) {
      console.error('Failed to save mapping:', error);
      return false;
    }
  },
  
  fetchSyncLogs: async (restaurantId: string, orderId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('zonesoft-api', {
        body: { action: 'get-sync-logs', restaurantId, orderId, limit: 20 },
      });
      
      if (error) throw error;
      
      set({ syncLogs: data.data || [] });
    } catch (error) {
      console.error('Failed to fetch sync logs:', error);
    }
  },
  
  clearError: () => set({ error: null }),
  
  reset: () => set({
    config: null,
    mappings: [],
    syncLogs: [],
    zoneSoftProducts: [],
    isLoading: false,
    isSyncing: false,
    error: null,
  }),
}));
