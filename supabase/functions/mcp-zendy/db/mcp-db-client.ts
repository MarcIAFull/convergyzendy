/**
 * MCP DB Client - Fetches menu, synonyms, and customer data
 * Self-contained (no _shared import) to avoid deploy issues.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

export interface MenuProduct {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
  price: number;
  is_available: boolean;
  search_keywords?: string[];
  ingredients?: string[];
  addons?: unknown[];
  addon_groups?: AddonGroup[];
  max_addons?: number | null;
  free_addons_count?: number | null;
}

export interface AddonGroup {
  id: string;
  name: string;
  sort_order?: number;
  min_selections?: number;
  max_selections?: number;
  free_selections?: number;
}

export interface Synonym {
  original_term: string;
  synonym: string;
}

export interface LoadMenuResult {
  products: MenuProduct[];
  synonyms: Synonym[];
}

/**
 * Load full menu for a restaurant (products + synonyms)
 */
export async function loadMenu(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<LoadMenuResult> {
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select(`
      id, name, sort_order,
      products!inner (
        id, name, description, price, is_available, max_addons, free_addons_count,
        addons (id, name, price, group_id),
        addon_groups (id, name, sort_order, min_selections, max_selections, free_selections)
      )
    `)
    .eq('restaurant_id', restaurantId)
    .eq('products.is_available', true)
    .order('sort_order');

  if (catError) {
    console.error('[mcp-db] Error loading menu:', catError);
    return { products: [], synonyms: [] };
  }

  const products: MenuProduct[] = (categories || [])
    .flatMap((cat: { products?: unknown[]; name?: string }) =>
      (cat.products || [])
        .filter((p: { id?: string; name?: string }) => p && p.name && p.id)
        .map((p: Record<string, unknown>) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          description: p.description,
          category: (cat as { name?: string }).name,
          is_available: p.is_available ?? true,
          addons: p.addons || [],
          addon_groups: ((p.addon_groups as AddonGroup[]) || []).sort(
            (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
          ),
          max_addons: p.max_addons ?? null,
          free_addons_count: p.free_addons_count ?? null,
        }))
    );

  let synonyms: Synonym[] = [];
  try {
    const { data: synonymsData } = await supabase
      .from('product_synonyms')
      .select('original_term, synonym')
      .eq('restaurant_id', restaurantId);
    synonyms = synonymsData || [];
  } catch {
    // Non-critical
  }

  return { products, synonyms };
}

/**
 * Get customer insights (order history, preferences)
 * Inlined from _shared/customerInsights to avoid cross-folder imports at deploy.
 */
export async function getCustomerHistory(
  supabase: SupabaseClient,
  customerPhone: string
) {
  try {
    const { data: insights, error } = await supabase
      .from('customer_insights')
      .select('*')
      .eq('phone', customerPhone)
      .maybeSingle();

    if (error || !insights) return null;

    return {
      phone: insights.phone,
      order_count: insights.order_count || 0,
      average_ticket: insights.average_ticket ? parseFloat(Number(insights.average_ticket).toFixed(2)) : null,
      order_frequency_days: insights.order_frequency_days,
      preferred_items: insights.preferred_items || [],
      preferred_addons: insights.preferred_addons || [],
      rejected_items: insights.rejected_items || [],
      last_order_id: insights.last_order_id,
      last_interaction_at: insights.last_interaction_at,
      notes: insights.notes,
    };
  } catch {
    return null;
  }
}
