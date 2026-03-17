/**
 * get_product_addons tool - Get addons by group with offset
 * WHEN: Before add_to_cart when customer asks about customizations. Use addon_group_index and offset for products with many groups/options.
 */

import type { McpServer } from 'mcp-lite';
import { z } from 'zod';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { loadMenu } from '../db/mcp-db-client.ts';

const PAGE_SIZE = 15;

type ExecutorReg = (name: string, h: (a: Record<string, any>) => Promise<{ content: Array<{ type: 'text'; text: string }> }>) => void;

export function registerGetProductAddonsTool(mcp: McpServer, reg?: ExecutorReg) {
  const handler = async (args: Record<string, any>) => {
    const { restaurant_id, product_id, addon_group_index, offset = 0 } = args as {
      restaurant_id: string; product_id: string; addon_group_index?: number; offset?: number;
    };
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { products } = await loadMenu(supabase, restaurant_id);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let product = products.find(p => p.id === product_id);
    if (!product && !uuidRegex.test(product_id)) {
      const normalized = product_id.toLowerCase();
      product = products.find(p => (p.name || '').toLowerCase() === normalized) ||
        products.find(p => normalized.includes((p.name || '').toLowerCase())) ||
        products.find(p => (p.name || '').toLowerCase().includes(normalized));
    }
    if (!product) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Produto não encontrado' }) }] };
    }
    const groups = (product.addon_groups || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const addonsByGroup = (product.addons || []).reduce(
      (acc: Record<string, Array<{ id: string; name: string; price: number }>>, a: any) => {
        const gid = a.group_id || 'default';
        if (!acc[gid]) acc[gid] = [];
        acc[gid].push({ id: a.id, name: a.name, price: a.price });
        return acc;
      },
      {} as Record<string, Array<{ id: string; name: string; price: number }>>
    );
    if (groups.length === 0) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, product_id: product.id, product_name: product.name, has_addons: false, addon_groups: [], message: `${product.name} não tem complementos disponíveis.` }) }] };
    }
    if (addon_group_index === undefined) {
      const summary = groups.map((g, i) => ({ index: i, name: g.name, min_selections: g.min_selections ?? 0, max_selections: g.max_selections ?? 1, free_selections: g.free_selections ?? 0, addons_count: (addonsByGroup[g.id] || []).length }));
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, product_id: product.id, product_name: product.name, has_addons: true, addon_groups_summary: summary, message: `Use get_product_addons com addon_group_index (0 a ${groups.length - 1}) para ver opções de cada grupo.` }) }] };
    }
    if (addon_group_index >= groups.length) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: `addon_group_index ${addon_group_index} inválido. Grupos: 0 a ${groups.length - 1}.` }) }] };
    }
    const group = groups[addon_group_index];
    const groupAddons = addonsByGroup[group.id] || [];
    const total = groupAddons.length;
    const page = groupAddons.slice(offset, offset + PAGE_SIZE);
    const hasMore = offset + page.length < total;
    const output = {
      success: true,
      product_id: product.id,
      product_name: product.name,
      addon_group_index,
      addon_group_name: group.name,
      min_selections: group.min_selections ?? 0,
      max_selections: group.max_selections ?? 1,
      free_selections: group.free_selections ?? 0,
      addons: page.map(a => ({ id: a.id, name: a.name, price: a.price })),
      offset,
      total,
      hasMore,
      message: page.length > 0 ? `${group.name}: ${page.map(a => `${a.name} (+€${a.price.toFixed(2)})`).join(', ')}${hasMore ? '... (use offset para mais)' : ''}` : 'Sem opções neste grupo.',
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(output) }] };
  };

  if (reg) reg('get_product_addons', handler);

  mcp.tool(
    'get_product_addons',
    z.object({
      restaurant_id: z.string().uuid().describe('Restaurant UUID'),
      product_id: z
        .string()
        .describe('Product UUID (from search_menu) or exact product name'),
      addon_group_index: z
        .number()
        .min(0)
        .optional()
        .describe('Which addon group/step to show (0-based). Omit to see all groups summary.'),
      offset: z
        .number()
        .min(0)
        .optional()
        .default(0)
        .describe('Pagination offset within the group (when group has many options)'),
    }),
    handler,
    {
      description:
        'WHEN: Before add_to_cart when customer asks about customizations. Use addon_group_index for products with multiple steps; use offset when a group has many options.',
    }
  );
}
