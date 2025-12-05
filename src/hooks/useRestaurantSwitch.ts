import { useCallback } from 'react';
import { toast } from 'sonner';
import { useRestaurantStore } from '@/stores/restaurantStore';
import { useOrderStore } from '@/stores/orderStore';
import { useMenuStore } from '@/stores/menuStore';
import { useCustomersStore } from '@/stores/customersStore';
import { useConversationsStore } from '@/stores/conversationsStore';
import type { Restaurant } from '@/types/database';

const STORAGE_KEY = 'zendy_active_restaurant';

/**
 * Hook central para troca de restaurantes
 * Garante que todos os stores dependentes são limpos antes da troca
 */
export const useRestaurantSwitch = () => {
  const setRestaurant = useRestaurantStore((state) => state.setRestaurant);

  /**
   * Limpa todos os stores dependentes do restaurante
   */
  const resetAllStores = useCallback(() => {
    console.log('[useRestaurantSwitch] 🧹 Resetting all dependent stores...');
    
    // Reset each store
    useOrderStore.getState().reset();
    useMenuStore.getState().reset();
    useCustomersStore.getState().reset();
    useConversationsStore.getState().reset();
    
    console.log('[useRestaurantSwitch] ✅ All stores reset');
  }, []);

  /**
   * Troca o restaurante ativo de forma segura
   * 1. Limpa todos os stores dependentes
   * 2. Atualiza o restaurante ativo
   * 3. Persiste no localStorage
   * 4. Notifica o usuário
   */
  const switchRestaurant = useCallback((restaurant: Restaurant) => {
    console.log('[useRestaurantSwitch] 🔄 Switching to restaurant:', restaurant.name);
    
    // 1. Limpar stores ANTES de trocar
    resetAllStores();
    
    // 2. Atualizar restaurante ativo e persistir
    localStorage.setItem(STORAGE_KEY, restaurant.id);
    setRestaurant(restaurant);
    
    // 3. Notificar usuário
    toast.success(`Restaurante ativo: ${restaurant.name}`);
    
    console.log('[useRestaurantSwitch] ✅ Switch complete');
  }, [resetAllStores, setRestaurant]);

  /**
   * Limpa o restaurante ativo e todos os stores
   */
  const clearAll = useCallback(() => {
    console.log('[useRestaurantSwitch] 🧹 Clearing all restaurant data...');
    
    resetAllStores();
    localStorage.removeItem(STORAGE_KEY);
    setRestaurant(null);
    
    console.log('[useRestaurantSwitch] ✅ All data cleared');
  }, [resetAllStores, setRestaurant]);

  return { 
    switchRestaurant, 
    resetAllStores, 
    clearAll 
  };
};
