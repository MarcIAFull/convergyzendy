/**
 * Addon selection tools - parse, update, clear customization draft
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { loadMenu } from '../db/mcp-db-client.ts';
import { normalizeText } from '../lib/smart-search-v2.ts';

function tokenize(text: string): string[] {
  return normalizeText(text).split(/[\s\-_,\.e]+/).filter(w => w.length > 1);
}

function fuzzyMatchAddon(term: string, addonName: string): number {
  const t = normalizeText(term);
  const a = normalizeText(addonName);
  if (a === t) return 1;
  if (a.includes(t) || t.includes(a)) return 0.9;
  const tt = tokenize(t);
  const at = tokenize(a);
  let score = 0;
  for (const tk of tt) {
    const best = Math.max(...at.map(ak => (ak.includes(tk) || tk.includes(ak)) ? 0.8 : 0));
    score += best;
  }
  return tt.length > 0 ? score / tt.length : 0;
}

type ExecutorReg = (name: string, h: (a: Record<string, any>) => Promise<{ content: Array<{ type: 'text'; text: string }> }>) => void;

export function registerAddonSelectionTools(_mcp: any, reg?: ExecutorReg) {
  const parseHandler = async (args: Record<string, any>) => {
    const { restaurant_id, product_id, user_message } = args as { restaurant_id: string; product_id: string; user_message: string };
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { products } = await loadMenu(supabase, restaurant_id);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let product = products.find(p => p.id === product_id);
    if (!product && !uuidRegex.test(product_id)) {
      const n = product_id.toLowerCase();
      product = products.find(p => (p.name || '').toLowerCase().includes(n)) ||
        products.find(p => n.includes((p.name || '').toLowerCase()));
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

    const terms = user_message.split(/,|\s+e\s+/i).map(s => s.trim()).filter(Boolean);
    const mapped: Record<string, string[]> = {};
    const unmapped: string[] = [];
    const MIN_SIM = 0.5;

    for (const term of terms) {
      let best: { groupId: string; addonId: string; score: number } | null = null;
      for (const [gid, addons] of Object.entries(addonsByGroup)) {
        for (const addon of addons) {
          const score = fuzzyMatchAddon(term, addon.name);
          if (score >= MIN_SIM && (!best || score > best.score)) {
            best = { groupId: gid, addonId: addon.id, score };
          }
        }
      }
      if (best) {
        const gname = groups.find(g => g.id === best!.groupId)?.name || best.groupId;
        if (!mapped[gname]) mapped[gname] = [];
        if (!mapped[gname].includes(best.addonId)) mapped[gname].push(best.addonId);
      } else {
        unmapped.push(term);
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true, product_id: product.id, product_name: product.name,
          mapped, unmapped,
          suggestion: unmapped.length > 0
            ? `Termos não encontrados: ${unmapped.join(', ')}. Confirmar antes de add_to_cart.`
            : 'Confirmar mapeamento antes de add_to_cart.',
        }),
      }],
    };
  };
  if (reg) reg('parse_addon_selections', parseHandler);

  const updateHandler = async (args: Record<string, any>) => {
    const { restaurant_id, customer_phone, product_id, group_index, addon_ids } = args as {
      restaurant_id: string; customer_phone: string; product_id: string; group_index: number; addon_ids: string[];
    };
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: state } = await supabase
      .from('conversation_state').select('metadata')
      .eq('restaurant_id', restaurant_id).eq('user_phone', customer_phone).maybeSingle();

    const metadata = (state?.metadata as Record<string, any>) || {};
    let draft = (metadata.customization_draft as { product_id?: string; selected_by_group?: Record<string, string[]> }) || { product_id, selected_by_group: {} };
    if (draft.product_id !== product_id) draft = { product_id, selected_by_group: {} };
    draft.selected_by_group = draft.selected_by_group || {};
    draft.selected_by_group[String(group_index)] = addon_ids;

    const { error } = await supabase.from('conversation_state').upsert(
      { restaurant_id, user_phone: customer_phone, metadata: { ...metadata, customization_draft: draft }, updated_at: new Date().toISOString() },
      { onConflict: 'restaurant_id,user_phone' }
    );

    if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: error.message }) }] };
    return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, draft, message: `Grupo ${group_index} atualizado com ${addon_ids.length} addon(s).` }) }] };
  };
  if (reg) reg('update_addon_selection', updateHandler);

  const clearHandler = async (args: Record<string, any>) => {
    const { restaurant_id, customer_phone } = args as { restaurant_id: string; customer_phone: string };
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: state } = await supabase.from('conversation_state').select('metadata')
      .eq('restaurant_id', restaurant_id).eq('user_phone', customer_phone).maybeSingle();

    const metadata = (state?.metadata as Record<string, any>) || {};
    const { customization_draft: _, ...rest } = metadata;

    const { error } = await supabase.from('conversation_state').upsert(
      { restaurant_id, user_phone: customer_phone, metadata: rest, updated_at: new Date().toISOString() },
      { onConflict: 'restaurant_id,user_phone' }
    );

    if (error) return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: error.message }) }] };
    return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, message: 'Rascunho de customização limpo.' }) }] };
  };
  if (reg) reg('clear_customization_draft', clearHandler);
}
