/**
 * search_menu tool - Search products with pagination (offset/limit)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { smartSearchProductsV2 } from '../lib/smart-search-v2.ts';
import { loadMenu } from '../db/mcp-db-client.ts';

type ExecutorReg = (name: string, h: (a: Record<string, any>) => Promise<{ content: Array<{ type: 'text'; text: string }> }>) => void;

export function registerSearchMenuTool(_mcp: any, reg?: ExecutorReg) {
  const handler = async (args: Record<string, any>) => {
    const { restaurant_id, query, category, max_results = 10, offset = 0 } = args as {
      restaurant_id: string; query?: string; category?: string; max_results?: number; offset?: number;
    };
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { products, synonyms } = await loadMenu(supabase, restaurant_id);

    if (!query && !category) {
      const categories = [...new Set(products.filter(p => p.category).map(p => p.category!))].sort();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ found: true, type: 'categories', count: categories.length, categories, message: `Categorias disponíveis: ${categories.join(', ')}` }) }],
      };
    }

    const effectiveMax = (!query && category) ? 50 : (max_results as number);
    const { results, total, hasMore } = smartSearchProductsV2(products, query, category, synonyms, { maxResults: effectiveMax, offset: offset as number });

    if (results.length === 0) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ found: false, count: 0, products: [], message: `Não encontrei "${query || category}" no menu. Posso mostrar as categorias disponíveis?` }) }],
      };
    }

    const output = {
      found: true,
      count: results.length,
      total,
      offset,
      hasMore,
      products: results.map(r => ({
        id: r.product.id,
        name: r.product.name,
        price: r.product.price,
        category: r.product.category,
        description: r.product.description,
        similarity: r.similarity,
        addons: r.product.addons || [],
        max_addons: r.product.max_addons ?? null,
        free_addons_count: r.product.free_addons_count ?? null,
      })),
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(output) }] };
  };

  if (reg) reg('search_menu', handler);
}
