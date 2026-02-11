import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem } from '@/types/public-menu';
import { Product, Addon } from '@/types/database';

const CART_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PublicCartState {
  items: CartItem[];
  slug: string | null;
  lastUpdated: number | null;
  addItem: (product: Product, quantity: number, selectedAddons: Addon[], notes: string) => void;
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

      setSlug: (slug: string) => {
        const currentSlug = get().slug;
        if (currentSlug && currentSlug !== slug) {
          set({ items: [], slug, lastUpdated: null });
        } else {
          set({ slug, lastUpdated: Date.now() });
        }
      },

      addItem: (product: Product, quantity: number, selectedAddons: Addon[], notes: string) => {
        const items = get().items;
        
        // Calcular preço total do item
        const addonsTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
        const totalPrice = (product.price + addonsTotal) * quantity;

        // Verificar se item idêntico já existe
        const existingItemIndex = items.findIndex(
          (item) =>
            item.product.id === product.id &&
            JSON.stringify(item.selectedAddons.map((a) => a.id).sort()) ===
              JSON.stringify(selectedAddons.map((a) => a.id).sort()) &&
            item.notes === notes
        );

        if (existingItemIndex >= 0) {
          // Atualizar quantidade do item existente
          const updatedItems = [...items];
          updatedItems[existingItemIndex].quantity += quantity;
          updatedItems[existingItemIndex].totalPrice += totalPrice;
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
              },
            ],
            lastUpdated: Date.now(),
          });
        }
      },

      removeItem: (productId: string, addonIds: string[]) => {
        const items = get().items;
        set({
          items: items.filter(
            (item) =>
              !(
                item.product.id === productId &&
                JSON.stringify(item.selectedAddons.map((a) => a.id).sort()) ===
                  JSON.stringify(addonIds.sort())
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

        const updatedItems = items.map((item) => {
          if (
            item.product.id === productId &&
            JSON.stringify(item.selectedAddons.map((a) => a.id).sort()) ===
              JSON.stringify(addonIds.sort())
          ) {
            const addonsTotal = item.selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
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
        if (state?.lastUpdated && Date.now() - state.lastUpdated > CART_TTL_MS) {
          state.items = [];
          state.lastUpdated = null;
          console.log('[PublicCart] Cart expired (>24h), cleared automatically');
        }
      },
    }
  )
);
