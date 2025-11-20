import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getStatePrompt, type OrderState } from "./state-prompts.ts";
import { updateCustomerInsightsAfterOrder } from "../_shared/customerInsights.ts";

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

interface SessionState {
  current_state: OrderState;
  has_open_cart: boolean;
  cart_item_count: number;
  cart_total: number;
  last_user_message: string | null;
  last_agent_message: string | null;
  last_order?: {
    id: string;
    status: string;
    confirmed_at: string;
    total: number;
  };
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

    // Load conversation history (last 15 messages for session state)
    const { data: messageHistory } = await supabase
      .from('messages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .or(`from_number.eq.${customerPhone},to_number.eq.${customerPhone}`)
      .order('timestamp', { ascending: true })
      .limit(15);

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

    // Load recent order for session state
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('id, status, total_amount, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('user_phone', customerPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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

    // Extract last messages for session state
    const lastUserMessage = messageHistory?.filter((m: any) => m.direction === 'inbound').slice(-1)[0]?.body || null;
    const lastAgentMessage = messageHistory?.filter((m: any) => m.direction === 'outbound').slice(-1)[0]?.body || null;

    // Determine current state from context
    let currentState: OrderState = 'idle';
    if (messageHistory && messageHistory.length > 0) {
      currentState = 'browsing_menu'; // Default to browsing if conversation exists
      if (cartItems.length > 0) {
        currentState = 'confirming_item';
      }
    }

    // Build structured session state
    const sessionState = {
      current_state: currentState,
      has_open_cart: cartItems.length > 0,
      cart_item_count: cartItems.length,
      cart_total: cartTotal,
      last_user_message: lastUserMessage,
      last_agent_message: lastAgentMessage,
      ...(lastOrder && {
        last_order: {
          id: lastOrder.id,
          status: lastOrder.status,
          confirmed_at: lastOrder.created_at,
          total: lastOrder.total_amount,
        },
      }),
    };

    console.log('[SessionState] Built session state:', JSON.stringify(sessionState, null, 2));

    const conversationState: ConversationState = {
      cart: cartItems,
      state: currentState,
    };

    console.log('Current State:', currentState);
    console.log('Cart Total:', cartTotal);

    // Build system prompt with session state
    const basePrompt = getStatePrompt(
      currentState,
      restaurant.name,
      categories,
      cartItems,
      cartTotal,
      restaurant.delivery_fee
    );

    const systemPrompt = `${basePrompt}

**SESSION STATE** (Use this to understand the current conversation context):
\`\`\`json
${JSON.stringify(sessionState, null, 2)}
\`\`\`

IMPORTANT RULES:
- Use the session_state to understand conversation context instead of relying on full message history
- If last_order exists and is recent (status: "new" or "completed"), do NOT reuse old carts
- Understand short references like "o mesmo", "cancela", "só limão" by checking last_user_message and last_agent_message
- If has_open_cart is false and user wants to order, start fresh
- If current_state is "order_completed" and user sends a new message, transition to "browsing_menu" for a new order
`;

    // Build conversation history for OpenAI (reduced to last 5 messages)
    const recentMessages = messageHistory?.slice(-5) || [];
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(recentMessages.map((msg: any) => ({
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
    const toolResults: any[] = [];

    if (aiMessage.tool_calls) {
      for (const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`Executing tool: ${functionName}`, args);

        try {
          switch (functionName) {
            case 'add_to_cart': {
              // Validate product exists
              const { data: product, error: productError } = await supabase
                .from('products')
                .select('id, name, price')
                .eq('id', args.product_id)
                .single();

              if (productError || !product) {
                console.error('Product not found:', args.product_id, productError);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'Product not found' }),
                });
                break;
              }

              // Find or create cart item for this product
              const { data: existingItem } = await supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('cart_id', cart!.id)
                .eq('product_id', args.product_id)
                .maybeSingle();

              let cartItemId: string;

              if (existingItem) {
                // Update quantity
                const { error: updateError } = await supabase
                  .from('cart_items')
                  .update({ quantity: existingItem.quantity + args.quantity })
                  .eq('id', existingItem.id);

                if (updateError) {
                  console.error('Error updating cart item:', updateError);
                  throw updateError;
                }
                cartItemId = existingItem.id;
              } else {
                // Insert new cart item
                const { data: newItem, error: insertError } = await supabase
                  .from('cart_items')
                  .insert({
                    cart_id: cart!.id,
                    product_id: args.product_id,
                    quantity: args.quantity,
                    notes: args.notes,
                  })
                  .select()
                  .single();

                if (insertError) {
                  console.error('Error inserting cart item:', insertError);
                  throw insertError;
                }
                cartItemId = newItem!.id;
              }

              // Add addons if provided (works for both new and existing items)
              if (args.addon_ids && args.addon_ids.length > 0) {
                // Check which addons are already added to avoid duplicates
                const { data: existingAddons } = await supabase
                  .from('cart_item_addons')
                  .select('addon_id')
                  .eq('cart_item_id', cartItemId);

                const existingAddonIds = new Set(existingAddons?.map(a => a.addon_id) || []);
                const newAddonIds = args.addon_ids.filter((id: string) => !existingAddonIds.has(id));

                if (newAddonIds.length > 0) {
                  const addonInserts = newAddonIds.map((addonId: string) => ({
                    cart_item_id: cartItemId,
                    addon_id: addonId,
                  }));
                  const { error: addonError } = await supabase
                    .from('cart_item_addons')
                    .insert(addonInserts);

                  if (addonError) {
                    console.error('Error adding addons:', addonError);
                    throw addonError;
                  }
                  console.log(`Added ${newAddonIds.length} addon(s) to cart item ${cartItemId}`);
                }
              }

              newState = 'confirming_item';
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: functionName,
                content: JSON.stringify({
                  success: true,
                  product_name: product.name,
                  quantity: args.quantity,
                  price: product.price,
                }),
              });
              
              console.log(`✅ Added ${args.quantity}x ${product.name} to cart ${cart!.id}`);
              break;
            }

            case 'remove_from_cart': {
              const { data: itemToRemove } = await supabase
                .from('cart_items')
                .select('id')
                .eq('cart_id', cart!.id)
                .eq('product_id', args.product_id)
                .maybeSingle();

              if (itemToRemove) {
                await supabase.from('cart_items').delete().eq('id', itemToRemove.id);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: true }),
                });
              } else {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'Item not in cart' }),
                });
              }
              break;
            }

            case 'update_cart_item': {
              const { data: itemToUpdate } = await supabase
                .from('cart_items')
                .select('id')
                .eq('cart_id', cart!.id)
                .eq('product_id', args.product_id)
                .maybeSingle();

              if (itemToUpdate) {
                await supabase
                  .from('cart_items')
                  .update({ quantity: args.quantity })
                  .eq('id', itemToUpdate.id);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: true }),
                });
              }
              break;
            }

            case 'set_delivery_address': {
              deliveryAddress = args.address;
              newState = 'collecting_payment';
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: functionName,
                content: JSON.stringify({ success: true, address: args.address }),
              });
              break;
            }

            case 'set_payment_method': {
              paymentMethod = args.method;
              newState = 'confirming_order';
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: functionName,
                content: JSON.stringify({ success: true, method: args.method }),
              });
              break;
            }

            case 'finalize_order': {
              if (args.confirmed && deliveryAddress && paymentMethod) {
                // Calculate final total
                const { data: finalCart } = await supabase
                  .from('carts')
                  .select(`
                    cart_items (
                      id,
                      quantity,
                      products (id, name, price),
                      cart_item_addons (
                        addon_id,
                        addons (id, name, price)
                      )
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
                const { data: newOrder, error: orderError } = await supabase
                  .from('orders')
                  .insert({
                    restaurant_id: restaurantId,
                    user_phone: customerPhone,
                    cart_id: cart!.id,
                    delivery_address: deliveryAddress,
                    payment_method: paymentMethod,
                    total_amount: finalTotal,
                    status: 'new',
                  })
                  .select()
                  .single();

                if (orderError) {
                  console.error('[OrderCreation] Error creating order:', orderError);
                  throw orderError;
                }

                console.log(`[OrderCreation] ✅ Order created: ${newOrder.id}`);

                // Mark cart as completed
                await supabase
                  .from('carts')
                  .update({ status: 'completed' })
                  .eq('id', cart!.id);

                // Update customer insights (best-effort, non-blocking)
                try {
                  const orderItems = finalCart!.cart_items.map((item: any) => ({
                    productId: item.products.id,
                    productName: item.products.name,
                    addons: item.cart_item_addons?.map((cia: any) => ({
                      addonId: cia.addons.id,
                      addonName: cia.addons.name,
                    })) || [],
                  }));

                  await updateCustomerInsightsAfterOrder(supabase, {
                    phone: customerPhone,
                    orderId: newOrder.id,
                    total: finalTotal,
                    items: orderItems,
                    status: 'confirmed',
                  });
                } catch (insightsError) {
                  // Already logged in the helper, just continue
                  console.log('[OrderCreation] Customer insights update failed but order was created successfully');
                }

                newState = 'order_completed';
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: true, total: finalTotal }),
                });
              } else {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'Missing address or payment method' }),
                });
              }
              break;
            }

            case 'transition_state': {
              if (canTransition(currentState, args.next_state)) {
                newState = args.next_state;
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: true, new_state: newState }),
                });
              } else {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: functionName,
                  content: JSON.stringify({ success: false, error: 'Invalid state transition' }),
                });
              }
              break;
            }
          }
        } catch (toolError) {
          console.error(`Error executing tool ${functionName}:`, toolError);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: JSON.stringify({
              success: false,
              error: toolError instanceof Error ? toolError.message : 'Unknown error',
            }),
          });
        }
      }

      // Make second OpenAI call with tool results to get final response
      const followUpMessages = [
        ...messages,
        aiMessage,
        ...toolResults,
      ];

      const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: followUpMessages,
          temperature: 0.7,
        }),
      });

      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        const finalMessage = followUpData.choices[0].message;
        console.log('Final AI Response:', finalMessage.content);

        const responseText = finalMessage.content || 'Produto adicionado ao carrinho!';

        console.log(`State transition: ${currentState} -> ${newState}`);

        // Reload cart after tool execution
        const { data: updatedCart } = await supabase
          .from('carts')
          .select(`
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
          .eq('id', cart!.id)
          .single();

        const updatedCartItems: CartItem[] = updatedCart?.cart_items?.map((item: any) => ({
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

        console.log('Updated cart items:', updatedCartItems.length, 'items');

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
            cart: updatedCartItems,
            delivery_address: deliveryAddress,
            payment_method: paymentMethod,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        console.error('Follow-up OpenAI call failed');
        throw new Error('Failed to get AI response after tool execution');
      }
    } else {
      // No tool calls, use direct response
      const responseText = aiMessage.content || 'Olá! Como posso ajudar?';

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
    }
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
