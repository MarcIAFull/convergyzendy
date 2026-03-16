import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem } from '@/types/public-menu';
import { Product, Addon } from '@/types/database';

const CART_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface PublicCartState {
  items: CartItem[];
  slug: string | null;
  lastUpdated: number | null;
  _hasHydrated: boolean;
  addItem: (product: Product, quantity: number, selectedAddons: Addon[], notes: string, unitPrice: number) => void;
  removeItem: (productId: string, addonIds: string[]) => void;
  updateItemQuantity: (productId: string, addonIds: string[], quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  setSlug: (slug: string) => void;
}

export const usePublicCartStore = create<PublicCartState>()(
  persist(
    (set, get) => ({
      items: [],
      slug: null,
      lastUpdated: null,
      _hasHydrated: false,

      setSlug: (slug: string) => {
        const currentSlug = get().slug;
        if (currentSlug && currentSlug !== slug) {
          set({ items: [], slug, lastUpdated: null });
        } else {
          set({ slug, lastUpdated: Date.now() });
        }
      },

      addItem: (product: Product, quantity: number, selectedAddons: Addon[], notes: string, unitPrice: number) => {
        const items = get().items;
        
        // Build addon frequency key for matching (handles duplicates)
        const buildAddonKey = (addons: Addon[]) => {
          const freq: Record<string, number> = {};
          addons.forEach(a => { freq[a.id] = (freq[a.id] || 0) + 1; });
          return JSON.stringify(Object.entries(freq).sort(([a], [b]) => a.localeCompare(b)));
        };

        const totalPrice = unitPrice * quantity;
        const addonKey = buildAddonKey(selectedAddons);

        // Verificar se item idêntico já existe
        const existingItemIndex = items.findIndex(
          (item) =>
            item.product.id === product.id &&
            buildAddonKey(item.selectedAddons) === addonKey &&
            item.notes === notes
        );

        if (existingItemIndex >= 0) {
          // Atualizar quantidade do item existente
          const updatedItems = [...items];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity + quantity,
            totalPrice: updatedItems[existingItemIndex].totalPrice + totalPrice,
            unitPrice,
          };
          set({ items: updatedItems, lastUpdated: Date.now() });
        } else {
          // Adicionar novo item
          set({
            items: [
              ...items,
              {
                product,
                quantity,
                selectedAddons,
                notes,
                totalPrice,
                unitPrice,
              },
            ],
            lastUpdated: Date.now(),
          });
        }
      },

      removeItem: (productId: string, addonIds: string[]) => {
        const items = get().items;
        const buildAddonKey = (ids: string[]) => {
          const freq: Record<string, number> = {};
          ids.forEach(id => { freq[id] = (freq[id] || 0) + 1; });
          return JSON.stringify(Object.entries(freq).sort(([a], [b]) => a.localeCompare(b)));
        };
        const targetKey = buildAddonKey(addonIds);
        set({
          items: items.filter(
            (item) =>
              !(
                item.product.id === productId &&
                buildAddonKey(item.selectedAddons.map(a => a.id)) === targetKey
              )
          ),
        });
      },

      updateItemQuantity: (productId: string, addonIds: string[], quantity: number) => {
        const items = get().items;
        if (quantity <= 0) {
          get().removeItem(productId, addonIds);
          return;
        }

        const buildAddonKey = (ids: string[]) => {
          const freq: Record<string, number> = {};
          ids.forEach(id => { freq[id] = (freq[id] || 0) + 1; });
          return JSON.stringify(Object.entries(freq).sort(([a], [b]) => a.localeCompare(b)));
        };
        const targetKey = buildAddonKey(addonIds);

        const updatedItems = items.map((item) => {
          if (
            item.product.id === productId &&
            buildAddonKey(item.selectedAddons.map(a => a.id)) === targetKey
          ) {
            const freeCount = item.product.free_addons_count ?? 0;
            const paidAddons = freeCount > 0 ? item.selectedAddons.slice(freeCount) : item.selectedAddons;
            const addonsTotal = paidAddons.reduce((sum, addon) => sum + addon.price, 0);
            const unitPrice = item.product.price + addonsTotal;
            return {
              ...item,
              quantity,
              totalPrice: unitPrice * quantity,
            };
          }
          return item;
        });

        set({ items: updatedItems });
      },

      clearCart: () => set({ items: [], lastUpdated: null }),

      getTotalItems: () => {
        const items = get().items;
        return items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getSubtotal: () => {
        const items = get().items;
        return items.reduce((sum, item) => sum + item.totalPrice, 0);
      },
    }),
    {
      name: 'zendy-public-cart',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true;
          if (state.lastUpdated && Date.now() - state.lastUpdated > CART_TTL_MS) {
            state.items = [];
            state.lastUpdated = null;
            console.log('[PublicCart] Cart expired (>12h), cleared automatically');
          }
        }
      },
    }
  )
);
