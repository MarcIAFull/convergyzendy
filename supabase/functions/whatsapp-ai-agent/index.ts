import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  notes?: string;
  addons: Array<{ addon_id: string; name: string; price: number }>;
}

interface ConversationState {
  cart: CartItem[];
  delivery_address?: string;
  payment_method?: string;
  stage: 'browsing' | 'cart_review' | 'address' | 'payment' | 'confirmation';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { restaurantId, customerPhone, messageBody } = await req.json();

    // Load restaurant and menu
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }

    // Load complete menu
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true });

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true);

    const { data: addons, error: addonsError } = await supabase
      .from('addons')
      .select('*')
      .in('product_id', products?.map(p => p.id) || []);

    if (categoriesError || productsError || addonsError) {
      throw new Error('Failed to load menu');
    }

    // Build menu structure
    const menuStructure = categories?.map(cat => ({
      category: cat.name,
      products: products?.filter(p => p.category_id === cat.id).map(prod => ({
        id: prod.id,
        name: prod.name,
        description: prod.description,
        price: Number(prod.price),
        addons: addons?.filter(a => a.product_id === prod.id).map(addon => ({
          id: addon.id,
          name: addon.name,
          price: Number(addon.price),
        })) || [],
      })) || [],
    })) || [];

    // Load conversation history
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('from_number', customerPhone)
      .order('timestamp', { ascending: true })
      .limit(20);

    // Get or create active cart
    const { data: existingCart } = await supabase
      .from('carts')
      .select('*, cart_items(*, cart_item_addons(addon_id))')
      .eq('restaurant_id', restaurantId)
      .eq('user_phone', customerPhone)
      .eq('status', 'active')
      .maybeSingle();

    let conversationState: ConversationState = {
      cart: [],
      stage: 'browsing',
    };

    if (existingCart) {
      conversationState.cart = existingCart.cart_items?.map((item: any) => {
        const product = products?.find(p => p.id === item.product_id);
        return {
          product_id: item.product_id,
          product_name: product?.name || 'Unknown',
          quantity: item.quantity,
          price: Number(product?.price || 0),
          notes: item.notes,
          addons: item.cart_item_addons?.map((cia: any) => {
            const addon = addons?.find(a => a.id === cia.addon_id);
            return {
              addon_id: cia.addon_id,
              name: addon?.name || 'Unknown',
              price: Number(addon?.price || 0),
            };
          }) || [],
        };
      }) || [];
    }

    // Build conversation history for context
    const conversationHistory = messages?.map(msg => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.body,
    })) || [];

    // System prompt with strict rules
    const systemPrompt = `Você é um assistente de pedidos para o restaurante "${restaurant.name}".

REGRAS ESTRITAS QUE NUNCA PODE QUEBRAR:
1. Responda SEMPRE em Português Europeu (de Portugal, não Brasil)
2. NUNCA invente produtos, preços ou informações - use APENAS os dados do menu fornecido
3. Se o cliente pedir algo que não existe, diga claramente que não está disponível
4. Use as ferramentas (tools) para adicionar/remover do carrinho e finalizar pedidos
5. Seja simpático, natural e eficiente

MENU DISPONÍVEL:
${JSON.stringify(menuStructure, null, 2)}

CARRINHO ATUAL DO CLIENTE:
${conversationState.cart.length > 0 ? conversationState.cart.map(item => 
  `• ${item.quantity}x ${item.product_name} (€${item.price.toFixed(2)})${
    item.addons.length > 0 ? ` + ${item.addons.map(a => a.name).join(', ')}` : ''
  }`
).join('\n') : 'Vazio'}

TOTAL ATUAL: €${conversationState.cart.reduce((sum, item) => {
  const itemTotal = (item.price + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity;
  return sum + itemTotal;
}, 0).toFixed(2)}

TAXA DE ENTREGA: €${Number(restaurant.delivery_fee).toFixed(2)}

FLUXO DO PEDIDO:
1. Cliente escolhe produtos → use add_to_cart com product_id e quantity
2. Confirme cada adição mostrando nome e preço corretos
3. Quando tiver itens no carrinho, pergunte se deseja adicionar mais ou finalizar
4. Para finalizar:
   a) Pergunte a morada de entrega completa
   b) Pergunte o método de pagamento (Dinheiro, Multibanco, MBWay)
   c) Mostre resumo: itens + subtotal + entrega + total
   d) Confirme o pedido → use finalize_order com delivery_address e payment_method

IMPORTANTE:
- Se não tem certeza do produto, pergunte ou sugira opções do menu
- Preços devem sempre corresponder aos do menu
- Use as ferramentas para modificar o carrinho
- Seja claro sobre custos e tempo de entrega

Responda à mensagem do cliente de forma natural e útil.`;

    // Define tools for structured operations
    const tools = [
      {
        type: 'function',
        function: {
          name: 'add_to_cart',
          description: 'Adiciona um produto ao carrinho com quantidade e extras opcionais',
          parameters: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'ID do produto' },
              quantity: { type: 'number', description: 'Quantidade' },
              addon_ids: { type: 'array', items: { type: 'string' }, description: 'IDs dos extras' },
              notes: { type: 'string', description: 'Notas especiais' },
            },
            required: ['product_id', 'quantity'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'remove_from_cart',
          description: 'Remove um produto do carrinho',
          parameters: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'ID do produto a remover' },
            },
            required: ['product_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'finalize_order',
          description: 'Finaliza o pedido após confirmar morada e método de pagamento',
          parameters: {
            type: 'object',
            properties: {
              delivery_address: { type: 'string', description: 'Morada de entrega' },
              payment_method: { type: 'string', description: 'Método de pagamento' },
            },
            required: ['delivery_address', 'payment_method'],
          },
        },
      },
    ];

    // Call Lovable AI with tools
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: messageBody },
        ],
        tools,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error('Failed to generate AI response');
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices[0];
    let assistantMessage = choice.message.content || '';
    const toolCalls = choice.message.tool_calls;

    console.log('AI Response:', assistantMessage);
    console.log('Tool Calls:', toolCalls);

    // Handle tool calls
    if (toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`Executing tool: ${functionName}`, args);

        if (functionName === 'add_to_cart') {
          // Get or create cart
          let cartId = existingCart?.id;
          if (!cartId) {
            const { data: newCart, error: cartError } = await supabase
              .from('carts')
              .insert({
                restaurant_id: restaurantId,
                user_phone: customerPhone,
                status: 'active',
              })
              .select()
              .single();

            if (cartError) throw cartError;
            cartId = newCart.id;
          }

          // Add product to cart
          const { data: cartItem, error: itemError } = await supabase
            .from('cart_items')
            .insert({
              cart_id: cartId,
              product_id: args.product_id,
              quantity: args.quantity,
              notes: args.notes || null,
            })
            .select()
            .single();

          if (itemError) throw itemError;

          // Add addons if specified
          if (args.addon_ids && args.addon_ids.length > 0) {
            const addonInserts = args.addon_ids.map((addonId: string) => ({
              cart_item_id: cartItem.id,
              addon_id: addonId,
            }));

            await supabase.from('cart_item_addons').insert(addonInserts);
          }

          const product = products?.find(p => p.id === args.product_id);
          assistantMessage += `\n\n✅ Adicionado: ${args.quantity}x ${product?.name} (€${Number(product?.price).toFixed(2)})`;

        } else if (functionName === 'remove_from_cart') {
          if (existingCart) {
            const { error: removeError } = await supabase
              .from('cart_items')
              .delete()
              .eq('cart_id', existingCart.id)
              .eq('product_id', args.product_id);

            if (removeError) throw removeError;

            const product = products?.find(p => p.id === args.product_id);
            assistantMessage += `\n\n✅ Removido: ${product?.name}`;
          }

        } else if (functionName === 'finalize_order') {
          if (!existingCart || conversationState.cart.length === 0) {
            assistantMessage += '\n\n❌ Carrinho vazio. Adicione produtos antes de finalizar.';
            continue;
          }

          // Calculate total
          const subtotal = conversationState.cart.reduce((sum, item) => {
            const itemTotal = (item.price + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity;
            return sum + itemTotal;
          }, 0);
          const totalAmount = subtotal + Number(restaurant.delivery_fee);

          // Create order
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
              restaurant_id: restaurantId,
              user_phone: customerPhone,
              cart_id: existingCart.id,
              delivery_address: args.delivery_address,
              payment_method: args.payment_method,
              total_amount: totalAmount,
              status: 'new',
            })
            .select()
            .single();

          if (orderError) throw orderError;

          // Update cart status
          await supabase
            .from('carts')
            .update({ status: 'completed' })
            .eq('id', existingCart.id);

          // Generate order summary
          const orderSummary = `
🎉 PEDIDO CONFIRMADO #${order.id.substring(0, 8)}

📦 Itens:
${conversationState.cart.map(item => 
  `• ${item.quantity}x ${item.product_name} - €${(item.price * item.quantity).toFixed(2)}${
    item.addons.length > 0 ? `\n  Extras: ${item.addons.map(a => a.name).join(', ')}` : ''
  }`
).join('\n')}

💰 Subtotal: €${subtotal.toFixed(2)}
🚚 Entrega: €${Number(restaurant.delivery_fee).toFixed(2)}
💳 Total: €${totalAmount.toFixed(2)}

📍 Morada: ${args.delivery_address}
💳 Pagamento: ${args.payment_method}

Obrigado pelo seu pedido! Chegará em breve.`;

          assistantMessage = orderSummary;
        }
      }
    }

    // Send response via WhatsApp
    const { error: sendError } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        restaurantId,
        customerPhone,
        messageText: assistantMessage,
      },
    });

    if (sendError) {
      console.error('Error sending WhatsApp message:', sendError);
    }

    return new Response(
      JSON.stringify({ success: true, response: assistantMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('AI Agent error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
