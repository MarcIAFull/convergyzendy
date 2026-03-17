/**
 * get_customer_history tool - Retrieve customer order history and preferences
 * WHEN: Starting conversation with returning customer, making recommendations, or VIP treatment.
 */

import type { McpServer } from 'mcp-lite';
import { z } from 'zod';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { getCustomerHistory } from '../db/mcp-db-client.ts';

type ExecutorReg = (name: string, h: (a: Record<string, any>) => Promise<{ content: Array<{ type: 'text'; text: string }> }>) => void;

export function registerGetCustomerHistoryTool(mcp: McpServer, reg?: ExecutorReg) {
  const handler = async (args: Record<string, any>) => {
    const { customer_phone } = args as { customer_phone: string };
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const insights = await getCustomerHistory(supabase, customer_phone);

    if (!insights || insights.order_count === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              customer_status: 'new',
              message: 'Cliente novo - primeira interação.',
              order_count: 0,
              suggestions: ['Apresentar o cardápio', 'Perguntar preferências'],
            }),
          },
        ],
      };
    }

    const topItems = (insights.preferred_items as any[] || []).slice(0, 3);
    const topAddons = (insights.preferred_addons as any[] || []).slice(0, 3);
    const customerStatus =
      insights.order_count >= 5 ? 'vip' :
      insights.order_count >= 2 ? 'returning' : 'first_return';

    const suggestions: string[] = [];
    if (topItems.length > 0) {
      suggestions.push(`Sugerir: "${topItems[0].name}" (favorito)`);
    }
    if (customerStatus === 'vip') {
      suggestions.push('Cliente VIP - tratamento especial!');
    }

    const output = {
      success: true,
      customer_status: customerStatus,
      order_count: insights.order_count,
      average_ticket: insights.average_ticket ? `€${insights.average_ticket.toFixed(2)}` : null,
      favorite_items: topItems.map((i: any) => `${i.name} (${i.count}x)`),
      favorite_addons: topAddons.map((a: any) => `${a.name} (${a.count}x)`),
      suggestions,
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(output) }],
    };
  };

  if (reg) reg('get_customer_history', handler);

  mcp.tool(
    'get_customer_history',
    z.object({
      customer_phone: z.string().describe('Customer phone number'),
    }),
    handler,
    {
      description:
        'WHEN: Starting conversation with returning customer to personalize, making recommendations based on favorites, or checking if customer is VIP. Do NOT use for new customers or simple questions.',
    }
  );
}
