/**
 * MCP Flow - Alternative to Orchestrator + Conversational AI when MCP_USE_MCP=true
 * Uses mcp-zendy Edge Function for tool execution
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { sendWhatsAppMessage } from '../_shared/evolutionClient.ts';

interface MCPFlowParams {
  restaurantId: string;
  customerPhone: string;
  rawMessage: string;
  instanceName: string;
  simulatorMode?: boolean;
}

const MCP_SYSTEM_PROMPT = `És o assistente de pedidos do restaurante. Responde em português de forma amigável e concisa.

CONTEXTO:
- restaurant_id: {restaurant_id}
- customer_phone: {customer_phone}
- Sempre inclui restaurant_id e customer_phone nas chamadas de tools.

REGRAS:
- Usa search_menu para buscar produtos (max 10-12 por vez; offset para paginação).
- Usa get_customer_history para personalizar saudação ou sugerir favoritos.
- Usa get_product_addons com addon_group_index para produtos com muitas opções.
- Para customizações numa mensagem: parse_addon_selections.
- Para trocar escolha: update_addon_selection.
- Para recomeçar: clear_customization_draft.
- Nunca inventes produtos ou preços. Usa apenas dados das tools.

CARDÁPIOS GRANDES: Nunca listar mais de 10-12 produtos por mensagem. Usar offset para paginação.
CUSTOMIZAÇÕES: Guiar por etapas com get_product_addons(addon_group_index). Confirmar cada etapa.
CASOS DE BORDA: Várias customizações de uma vez → parse_addon_selections. Trocar escolha → update_addon_selection. Recomeçar → clear_customization_draft.`;

const MCP_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_menu',
      description: 'WHEN: Customer asks about products, categories, or wants to browse. Use offset for large menus.',
      parameters: {
        type: 'object',
        properties: {
          restaurant_id: { type: 'string', description: 'Restaurant UUID' },
          customer_phone: { type: 'string', description: 'Customer phone' },
          query: { type: 'string', description: 'Search term' },
          category: { type: 'string', description: 'Filter by category' },
          max_results: { type: 'number', description: 'Max results (default 10)' },
          offset: { type: 'number', description: 'Pagination offset' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_customer_history',
      description: 'WHEN: Starting conversation with returning customer, making recommendations, or VIP treatment.',
      parameters: {
        type: 'object',
        properties: {
          customer_phone: { type: 'string', description: 'Customer phone' },
        },
        required: ['customer_phone'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_product_addons',
      description: 'WHEN: Before add_to_cart when customer asks about customizations. Use addon_group_index for multi-step products.',
      parameters: {
        type: 'object',
        properties: {
          restaurant_id: { type: 'string' },
          product_id: { type: 'string' },
          addon_group_index: { type: 'number', description: '0-based group index' },
          offset: { type: 'number', description: 'Pagination within group' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'parse_addon_selections',
      description: 'WHEN: Client sends multiple customizations in one message.',
      parameters: {
        type: 'object',
        properties: {
          restaurant_id: { type: 'string' },
          product_id: { type: 'string' },
          user_message: { type: 'string', description: 'Raw message with selections' },
        },
        required: ['restaurant_id', 'product_id', 'user_message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_addon_selection',
      description: 'WHEN: Client wants to change a previous selection.',
      parameters: {
        type: 'object',
        properties: {
          restaurant_id: { type: 'string' },
          customer_phone: { type: 'string' },
          product_id: { type: 'string' },
          group_index: { type: 'number' },
          addon_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'clear_customization_draft',
      description: 'WHEN: Client wants to restart customization from scratch.',
      parameters: {
        type: 'object',
        properties: {
          restaurant_id: { type: 'string' },
          customer_phone: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_cart',
      description: 'WHEN: Before finalizing order or when customer asks about cart contents.',
      parameters: {
        type: 'object',
        properties: {
          restaurant_id: { type: 'string' },
          customer_phone: { type: 'string' },
        },
      },
    },
  },
];

async function buildMinimalContext(
  supabase: SupabaseClient,
  restaurantId: string,
  customerPhone: string
): Promise<{ restaurantName: string; menuCategories: string; cartSummary: string; lastMessages: string }> {
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name')
    .eq('id', restaurantId)
    .maybeSingle();

  const { data: categories } = await supabase
    .from('categories')
    .select('name')
    .eq('restaurant_id', restaurantId)
    .order('sort_order');
  const menuCategories = (categories || []).map((c: { name: string }) => c.name).join(', ') || 'N/A';

  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data: carts } = await supabase
    .from('carts')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('user_phone', customerPhone)
    .eq('status', 'active')
    .gt('updated_at', twelveHoursAgo);
  const cartId = carts?.[0]?.id;
  let cartSummary = 'vazio';
  if (cartId) {
    const { data: items } = await supabase
      .from('cart_items')
      .select('quantity, products(price)')
      .eq('cart_id', cartId);
    const total = (items || []).reduce((s: number, i: any) =>
      s + i.quantity * (i.products?.price || 0), 0);
    cartSummary = `${(items || []).length} itens, €${total.toFixed(2)}`;
  }

  const { data: msgs } = await supabase
    .from('messages')
    .select('body, direction')
    .eq('restaurant_id', restaurantId)
    .or(`from_number.eq.${customerPhone},to_number.eq.${customerPhone}`)
    .order('timestamp', { ascending: false })
    .limit(5);
  const lastMessages = (msgs || [])
    .reverse()
    .map((m: { body: string; direction: string }) => `${m.direction === 'inbound' ? 'Cliente' : 'Tu'}: ${(m.body || '').slice(0, 60)}`)
    .join('\n');

  return {
    restaurantName: restaurant?.name || 'Restaurante',
    menuCategories,
    cartSummary,
    lastMessages,
  };
}

async function callMCPTool(
  supabase: SupabaseClient,
  name: string,
  args: Record<string, any>,
  context: { restaurant_id: string; customer_phone: string }
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('mcp-zendy', {
    body: { name, arguments: args, context },
  });
  if (error) {
    console.error(`[MCP Flow] Tool ${name} error:`, error);
    return JSON.stringify({ error: error.message });
  }
  return typeof data?.content === 'string' ? data.content : JSON.stringify(data);
}

export async function runMCPFlow(supabase: SupabaseClient, params: MCPFlowParams): Promise<Response> {
  const { restaurantId, customerPhone, rawMessage, instanceName } = params;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    console.error('[MCP Flow] OPENAI_API_KEY not set');
    return new Response(
      JSON.stringify({ error: 'MCP flow requires OPENAI_API_KEY' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let instance = instanceName;
  if (!instance) {
    const { data: whatsappInstance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    instance = whatsappInstance?.instance_name || Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'default';
  }

  try {
    const ctx = await buildMinimalContext(supabase, restaurantId, customerPhone);
    const systemPrompt = MCP_SYSTEM_PROMPT
      .replace('{restaurant_id}', restaurantId)
      .replace('{customer_phone}', customerPhone)
      + `\n\nRestaurante: ${ctx.restaurantName}\nCategorias: ${ctx.menuCategories}\nCarrinho: ${ctx.cartSummary}\n\nÚltimas mensagens:\n${ctx.lastMessages}`;

    const context = { restaurant_id: restaurantId, customer_phone: customerPhone };
    const messages: Array<any> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawMessage },
    ];

    let responseText = '';
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      iterations++;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          tools: MCP_TOOLS,
          tool_choice: 'auto',
        }),
      });

      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice) {
        console.error('[MCP Flow] No choice in response:', data);
        responseText = 'Desculpa, tive um problema. Podes repetir?';
        break;
      }

      const msg = choice.message;
      if (msg.content) {
        responseText = msg.content;
        break;
      }

      if (msg.tool_calls?.length) {
        messages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.tool_calls,
        });
        for (const tc of msg.tool_calls) {
          const name = tc.function?.name;
          const args = JSON.parse(tc.function?.arguments || '{}');
          const merged = { ...context, ...args };
          const result = await callMCPTool(supabase, name, merged, context);
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          });
        }
        continue;
      }

      responseText = 'Não consegui processar. Podes repetir?';
      break;
    }

    if (!responseText) {
      responseText = 'Desculpa, não consegui responder. Podes tentar de novo?';
    }

    await sendWhatsAppMessage(instance, customerPhone, responseText);

    return new Response(
      JSON.stringify({ success: true, response: responseText }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[MCP Flow] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'MCP flow failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
