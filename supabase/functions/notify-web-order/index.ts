import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyOrderRequest {
  order_id: string;
  restaurant_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { order_id, restaurant_id }: NotifyOrderRequest = await req.json();

    if (!order_id || !restaurant_id) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id or restaurant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[notify-web-order] Processing order ${order_id} for restaurant ${restaurant_id}`);

    // Fetch web order details
    const { data: order, error: orderError } = await supabase
      .from('web_orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('[notify-web-order] Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch restaurant phone
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('phone, name')
      .eq('id', restaurant_id)
      .single();

    if (restaurantError || !restaurant) {
      console.error('[notify-web-order] Restaurant not found:', restaurantError);
      return new Response(
        JSON.stringify({ error: 'Restaurant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch WhatsApp instance
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, status')
      .eq('restaurant_id', restaurant_id)
      .single();

    if (instanceError || !instance) {
      console.error('[notify-web-order] WhatsApp instance not found:', instanceError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured for this restaurant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (instance.status !== 'connected') {
      console.error('[notify-web-order] WhatsApp not connected');
      return new Response(
        JSON.stringify({ error: 'WhatsApp not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format order items
    const items = order.items as any[];
    const itemsText = items.map((item: any) => {
      let line = `• ${item.quantity}x ${item.product_name} - €${item.total.toFixed(2)}`;
      if (item.addons && item.addons.length > 0) {
        const addonNames = item.addons.map((a: any) => a.name).join(', ');
        line += `\n  + ${addonNames}`;
      }
      if (item.notes) {
        line += `\n  📝 ${item.notes}`;
      }
      return line;
    }).join('\n');

    // Format payment method
    const paymentMethodMap: Record<string, string> = {
      'cash': 'Dinheiro',
      'card': 'Cartão na entrega',
      'mbway': 'MBWay',
      'multibanco': 'Multibanco',
      'pix': 'PIX'
    };
    const paymentText = paymentMethodMap[order.payment_method] || order.payment_method;

    // Format timestamp
    const orderDate = new Date(order.created_at);
    const timeStr = orderDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    // Build message
    const shortOrderId = order_id.substring(0, 8).toUpperCase();
    const message = `🛒 *NOVO PEDIDO WEB #${shortOrderId}*

👤 *Cliente:* ${order.customer_name}
📱 *Telefone:* ${order.customer_phone}${order.customer_email ? `\n📧 *Email:* ${order.customer_email}` : ''}

📍 *Endereço:*
${order.delivery_address}${order.delivery_instructions ? `\n${order.delivery_instructions}` : ''}

📋 *Itens:*
${itemsText}

💰 *Subtotal:* €${order.subtotal.toFixed(2)}
🚚 *Taxa de Entrega:* €${order.delivery_fee.toFixed(2)}
💵 *TOTAL:* €${order.total_amount.toFixed(2)}

💳 *Pagamento:* ${paymentText}

⏰ Pedido recebido às ${timeStr}`;

    console.log(`[notify-web-order] Sending message to restaurant ${restaurant.phone} via instance ${instance.instance_name}`);

    // Send WhatsApp message to restaurant
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('[notify-web-order] Evolution API not configured');
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number for WhatsApp
    let formattedPhone = restaurant.phone.replace(/\D/g, '');
    if (!formattedPhone.endsWith('@s.whatsapp.net')) {
      formattedPhone = `${formattedPhone}@s.whatsapp.net`;
    }

    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/message/sendText/${instance.instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message,
        }),
      }
    );

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('[notify-web-order] Failed to send WhatsApp message:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp message', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionData = await evolutionResponse.json();
    console.log('[notify-web-order] WhatsApp message sent successfully:', evolutionData);

    // Log the outbound message
    await supabase
      .from('messages')
      .insert({
        restaurant_id: restaurant_id,
        from_number: 'system',
        to_number: restaurant.phone,
        body: message,
        direction: 'outbound',
        sent_by: 'system',
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'WhatsApp notification sent',
        order_id: order_id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[notify-web-order] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
