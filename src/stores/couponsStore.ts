import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface Coupon {
  id: string;
  restaurant_id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  usage_limit_per_phone: number;
  current_usage: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCouponData {
  code: string;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  usage_limit_per_phone?: number;
  starts_at?: string;
  expires_at?: string;
}

interface CouponsState {
  coupons: Coupon[];
  loading: boolean;
  error: string | null;
  fetchCoupons: (restaurantId: string) => Promise<void>;
  createCoupon: (restaurantId: string, data: CreateCouponData) => Promise<Coupon>;
  updateCoupon: (id: string, data: Partial<CreateCouponData>) => Promise<void>;
  deleteCoupon: (id: string) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
  reset: () => void;
}

export const useCouponsStore = create<CouponsState>((set, get) => ({
  coupons: [],
  loading: false,
  error: null,

  fetchCoupons: async (restaurantId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ coupons: data as Coupon[], loading: false });
    } catch (error) {
      console.error('[couponsStore] Error fetching coupons:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro ao carregar cupons', 
        loading: false 
      });
    }
  },

  createCoupon: async (restaurantId: string, data: CreateCouponData) => {
    try {
      const { data: newCoupon, error } = await supabase
        .from('coupons')
        .insert({
          restaurant_id: restaurantId,
          code: data.code.toUpperCase().trim(),
          name: data.name,
          description: data.description || null,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          min_order_value: data.min_order_value || 0,
          max_discount_amount: data.max_discount_amount || null,
          usage_limit: data.usage_limit || null,
          usage_limit_per_phone: data.usage_limit_per_phone ?? 1,
          starts_at: data.starts_at || new Date().toISOString(),
          expires_at: data.expires_at || null,
        })
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        coupons: [newCoupon as Coupon, ...state.coupons],
      }));

      return newCoupon as Coupon;
    } catch (error) {
      console.error('[couponsStore] Error creating coupon:', error);
      throw error;
    }
  },

  updateCoupon: async (id: string, data: Partial<CreateCouponData>) => {
    try {
      const updateData: Record<string, unknown> = { ...data };
      if (data.code) {
        updateData.code = data.code.toUpperCase().trim();
      }

      const { error } = await supabase
        .from('coupons')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        coupons: state.coupons.map((c) =>
          c.id === id ? { ...c, ...updateData } as Coupon : c
        ),
      }));
    } catch (error) {
      console.error('[couponsStore] Error updating coupon:', error);
      throw error;
    }
  },

  deleteCoupon: async (id: string) => {
    try {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;

      set((state) => ({
        coupons: state.coupons.filter((c) => c.id !== id),
      }));
    } catch (error) {
      console.error('[couponsStore] Error deleting coupon:', error);
      throw error;
    }
  },

  toggleActive: async (id: string) => {
    const coupon = get().coupons.find((c) => c.id === id);
    if (!coupon) return;

    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !coupon.is_active })
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        coupons: state.coupons.map((c) =>
          c.id === id ? { ...c, is_active: !c.is_active } : c
        ),
      }));
    } catch (error) {
      console.error('[couponsStore] Error toggling coupon:', error);
      throw error;
    }
  },

  reset: () => {
    set({ coupons: [], loading: false, error: null });
  },
}));
