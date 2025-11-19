import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getStatePrompt, type OrderState } from "./state-prompts.ts";

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
  state: OrderState;
  pending_item?: {
    product_id: string;
    quantity: number;
    addon_ids?: string[];
  };
}

// State machine transitions
const STATE_TRANSITIONS: Record<OrderState, OrderState[]> = {
  idle: ['browsing_menu'],
  browsing_menu: ['adding_item', 'collecting_address'],
  adding_item: ['choosing_addons', 'confirming_item'],
  choosing_addons: ['confirming_item'],
  confirming_item: ['browsing_menu', 'collecting_address'],
  collecting_address: ['collecting_payment'],
  collecting_payment: ['confirming_order'],
  confirming_order: ['order_completed', 'browsing_menu'],
  order_completed: ['idle'],
};

function canTransition(from: OrderState, to: OrderState): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { restaurantId, customerPhone, messageBody } = await req.json();

    console.log(`Processing message from ${customerPhone}: ${messageBody}`);

    // Load restaurant and menu
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }

    // Load menu structure
    const { data: categories } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        products (
          id,
          name,
          description,
          price,
          is_available,
          addons (
            id,
            name,
            price
          )
        )
      `)
      .eq('restaurant_id', restaurantId)
      .order('sort_order');

    // Load conversation history (last 20 messages)
    const { data: messageHistory } = await supabase
      .from('messages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${customerPhone},to_number.eq.${customerPhone}`)
      .order('timestamp', { ascending: true })
      .limit(20);

    // Load or create active cart
    let { data: cart } = await supabase
      .from('carts')
      .select(`
        id,
        status,
        cart_items (
          id,
          product_id,
          quantity,
          notes,
          products (
            id,
            name,
            price
          ),
          cart_item_addons (
            addon_id,
            addons (
              id,
              name,
              price
            )
          )
        )
      `)
      .eq('restaurant_id', restaurantId)
      .eq('user_phone', customerPhone)
      .eq('status', 'active')
      .maybeSingle();

    if (!cart) {
      const { data: newCart } = await supabase
        .from('carts')
        .insert({
          restaurant_id: restaurantId,
          user_phone: customerPhone,
          status: 'active',
        })
        .select()
        .single();
      cart = newCart;
    }

    // Build current state
    const cartItems: CartItem[] = cart?.cart_items?.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.products.name,
      quantity: item.quantity,
      price: item.products.price,
      notes: item.notes,
      addons: item.cart_item_addons?.map((cia: any) => ({
        addon_id: cia.addon_id,
        name: cia.addons.name,
        price: cia.addons.price,
      })) || [],
    })) || [];

    const cartTotal = cartItems.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const addonsTotal = item.addons.reduce((aSum, addon) => aSum + addon.price, 0) * item.quantity;
      return sum + itemTotal + addonsTotal;
    }, 0);

    // Determine current state from context
    let currentState: OrderState = 'idle';
    if (messageHistory && messageHistory.length > 0) {
      currentState = 'browsing_menu'; // Default to browsing if conversation exists
      if (cartItems.length > 0) {
        currentState = 'confirming_item';
      }
    }

    const conversationState: ConversationState = {
      cart: cartItems,
      state: currentState,
    };

    console.log('Current State:', currentState);
    console.log('Cart Total:', cartTotal);

    // Build system prompt
    const systemPrompt = getStatePrompt(
      currentState,
      restaurant.name,
      categories,
      cartItems,
      cartTotal,
      restaurant.delivery_fee
    );

    // Build conversation history for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(messageHistory?.map((msg: any) => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.body,
      })) || []),
      { role: 'user', content: messageBody },
    ];

    // Define tools for OpenAI
    const tools = [
      {
        type: 'function',
        function: {
          name: 'add_to_cart',
          description: 'Add a product to the customer cart',
          parameters: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'Product ID from menu' },
              quantity: { type: 'integer', description: 'Quantity to add', default: 1 },
              addon_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional addon IDs',
              },
              notes: { type: 'string', description: 'Optional notes' },
            },
            required: ['product_id', 'quantity'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'remove_from_cart',
          description: 'Remove a product from the cart',
          parameters: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'Product ID to remove' },
            },
            required: ['product_id'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_cart_item',
          description: 'Update quantity of an item in cart',
          parameters: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'Product ID to update' },
              quantity: { type: 'integer', description: 'New quantity' },
            },
            required: ['product_id', 'quantity'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'set_delivery_address',
          description: 'Set the delivery address',
          parameters: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Delivery address' },
            },
            required: ['address'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'set_payment_method',
          description: 'Set the payment method',
          parameters: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: ['cash', 'card', 'mbway'],
                description: 'Payment method',
              },
            },
            required: ['method'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'finalize_order',
          description: 'Create the final order',
          parameters: {
            type: 'object',
            properties: {
              confirmed: { type: 'boolean', description: 'Customer confirmed order' },
            },
            required: ['confirmed'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'transition_state',
          description: 'Move to next state in order flow',
          parameters: {
            type: 'object',
            properties: {
              next_state: {
                type: 'string',
                enum: [
                  'idle',
                  'browsing_menu',
                  'adding_item',
                  'choosing_addons',
                  'confirming_item',
                  'collecting_address',
                  'collecting_payment',
                  'confirming_order',
                  'order_completed',
                ],
                description: 'Next state',
              },
            },
            required: ['next_state'],
          },
        },
      },
    ];

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        tools,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const aiData = await openaiResponse.json();
    const aiMessage = aiData.choices[0].message;

    console.log('AI Response:', aiMessage.content);
    console.log('Tool Calls:', aiMessage.tool_calls);

    // Process tool calls
    let newState: OrderState = currentState;
    let deliveryAddress = conversationState.delivery_address;
    let paymentMethod = conversationState.payment_method;

    if (aiMessage.tool_calls) {
      for (const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`Executing tool: ${functionName}`, args);

        switch (functionName) {
          case 'add_to_cart': {
            // Find cart item for this product
            const { data: cartItems } = await supabase
              .from('cart_items')
              .select('id')
              .eq('cart_id', cart!.id)
              .eq('product_id', args.product_id)
              .maybeSingle();

            if (cartItems) {
              // Update quantity
              await supabase
                .from('cart_items')
                .update({ quantity: args.quantity })
                .eq('id', cartItems.id);
            } else {
              // Insert new cart item
              const { data: newItem } = await supabase
                .from('cart_items')
                .insert({
                  cart_id: cart!.id,
                  product_id: args.product_id,
                  quantity: args.quantity,
                  notes: args.notes,
                })
                .select()
                .single();

              // Add addons if provided
              if (args.addon_ids && args.addon_ids.length > 0) {
                const addonInserts = args.addon_ids.map((addonId: string) => ({
                  cart_item_id: newItem!.id,
                  addon_id: addonId,
                }));
                await supabase.from('cart_item_addons').insert(addonInserts);
              }
            }
            newState = 'confirming_item';
            break;
          }

          case 'remove_from_cart': {
            const { data: cartItems } = await supabase
              .from('cart_items')
              .select('id')
              .eq('cart_id', cart!.id)
              .eq('product_id', args.product_id)
              .maybeSingle();

            if (cartItems) {
              await supabase.from('cart_items').delete().eq('id', cartItems.id);
            }
            break;
          }

          case 'update_cart_item': {
            const { data: cartItems } = await supabase
              .from('cart_items')
              .select('id')
              .eq('cart_id', cart!.id)
              .eq('product_id', args.product_id)
              .maybeSingle();

            if (cartItems) {
              await supabase
                .from('cart_items')
                .update({ quantity: args.quantity })
                .eq('id', cartItems.id);
            }
            break;
          }

          case 'set_delivery_address': {
            deliveryAddress = args.address;
            newState = 'collecting_payment';
            break;
          }

          case 'set_payment_method': {
            paymentMethod = args.method;
            newState = 'confirming_order';
            break;
          }

          case 'finalize_order': {
            if (args.confirmed && deliveryAddress && paymentMethod) {
              // Calculate final total
              const { data: finalCart } = await supabase
                .from('carts')
                .select(`
                  cart_items (
                    quantity,
                    products (price),
                    cart_item_addons (addons (price))
                  )
                `)
                .eq('id', cart!.id)
                .single();

              const finalTotal = finalCart!.cart_items.reduce((sum: number, item: any) => {
                const itemTotal = item.products.price * item.quantity;
                const addonsTotal = item.cart_item_addons.reduce(
                  (aSum: number, cia: any) => aSum + cia.addons.price,
                  0
                ) * item.quantity;
                return sum + itemTotal + addonsTotal;
              }, 0) + restaurant.delivery_fee;

              // Create order
              await supabase.from('orders').insert({
                restaurant_id: restaurantId,
                user_phone: customerPhone,
                cart_id: cart!.id,
                delivery_address: deliveryAddress,
                payment_method: paymentMethod,
                total_amount: finalTotal,
                status: 'new',
              });

              // Mark cart as completed
              await supabase
                .from('carts')
                .update({ status: 'completed' })
                .eq('id', cart!.id);

              newState = 'order_completed';
            }
            break;
          }

          case 'transition_state': {
            if (canTransition(currentState, args.next_state)) {
              newState = args.next_state;
            }
            break;
          }
        }
      }
    }

    const responseText = aiMessage.content || 'Desculpe, ocorreu um erro.';

    console.log(`State transition: ${currentState} -> ${newState}`);

    // Save outgoing message
    await supabase.from('messages').insert({
      restaurant_id: restaurantId,
      from_number: restaurant.phone,
      to_number: customerPhone,
      body: responseText,
      direction: 'outbound',
    });

    // Send WhatsApp message
    try {
      await supabase.functions.invoke('whatsapp-send', {
        body: {
          restaurantId,
          customerPhone,
          messageText: responseText,
        },
      });
    } catch (sendError) {
      console.error('Error sending WhatsApp message:', sendError);
    }

    return new Response(
      JSON.stringify({
        response: responseText,
        state: newState,
        cart: cartItems,
        delivery_address: deliveryAddress,
        payment_method: paymentMethod,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in whatsapp-ai-agent:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
