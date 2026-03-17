/**
 * get_cart tool - Get cart details
 * WHEN: Before finalizing or when customer asks about cart contents.
 */

import type { McpServer } from 'mcp-lite';
import { z } from 'zod';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

type ExecutorReg = (name: string, h: (a: Record<string, any>) => Promise<{ content: Array<{ type: 'text'; text: string }> }>) => void;

export function registerGetCartTool(mcp: McpServer, reg?: ExecutorReg) {
  const handler = async (args: Record<string, any>) => {
    const { restaurant_id, customer_phone } = args as { restaurant_id: string; customer_phone: string };
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data: carts } = await supabase
      .from('carts')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .eq('user_phone', customer_phone)
      .eq('status', 'active')
      .gt('updated_at', twelveHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const cartId = carts?.[0]?.id;
    if (!cartId) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, items: [], total: 0, message: 'Carrinho vazio.' }) }],
      };
    }

    const { data: items } = await supabase
      .from('cart_items')
      .select(`
        id, quantity, notes, product_id,
        products (id, name, price),
        cart_item_addons (addons (id, name, price))
      `)
      .eq('cart_id', cartId);

    const cartItems = (items || []).map((item: any) => {
      const addonsTotal = (item.cart_item_addons || []).reduce((s: number, cia: any) => s + (cia.addons?.price || 0), 0);
      const unitPrice = item.products?.price || 0;
      const total = item.quantity * (unitPrice + addonsTotal);
      return {
        product_name: item.products?.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        addons: (item.cart_item_addons || []).map((cia: any) => cia.addons).filter(Boolean),
        total,
        notes: item.notes,
      };
    });

    const total = cartItems.reduce((s: number, i: any) => s + i.total, 0);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          items: cartItems,
          total: Math.round(total * 100) / 100,
          message: cartItems.length > 0 ? `${cartItems.length} item(ns), €${total.toFixed(2)}` : 'Carrinho vazio.',
        }),
      }],
    };
  };

  if (reg) reg('get_cart', handler);

  mcp.tool(
    'get_cart',
    z.object({
      restaurant_id: z.string().uuid(),
      customer_phone: z.string(),
    }),
    handler,
    {
      description: 'WHEN: Before finalizing order or when customer asks about cart contents.',
    }
  );
}
