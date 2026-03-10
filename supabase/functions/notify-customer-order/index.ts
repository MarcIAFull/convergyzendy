import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyCustomerRequest {
  order_id: string;
  restaurant_id: string;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery: '🚚 Entrega',
  dine_in: '🍽️ Na Mesa',
  takeaway: '🛍️ Take & Go',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { order_id, restaurant_id }: NotifyCustomerRequest = await req.json();

    if (!order_id || !restaurant_id) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id or restaurant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[notify-customer-order] Processing order ${order_id} for restaurant ${restaurant_id}`);

    // Fetch web order details
    const { data: order, error: orderError } = await supabase
      .from('web_orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('[notify-customer-order] Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch restaurant info
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurant_id)
      .single();

    if (restaurantError || !restaurant) {
      console.error('[notify-customer-order] Restaurant not found:', restaurantError);
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
      console.error('[notify-customer-order] WhatsApp instance not found:', instanceError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured for this restaurant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (instance.status !== 'connected') {
      console.error('[notify-customer-order] WhatsApp not connected');
      return new Response(
        JSON.stringify({ error: 'WhatsApp not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format order items
    const items = order.items as any[];
    const itemsText = items.map((item: any) => {
      let line = `• ${item.quantity}x ${item.product_name}`;
      if (item.addons && item.addons.length > 0) {
        const addonNames = item.addons.map((a: any) => a.name).join(', ');
        line += ` (+${addonNames})`;
      }
      return line;
    }).join('\n');

    // Format payment method
    const paymentMethodMap: Record<string, string> = {
      'cash': 'Dinheiro',
      'card': 'Cartão na entrega',
      'mbway': 'MBWay',
      'multibanco': 'Multibanco',
      'stripe': 'Pago Online'
    };
    const paymentText = paymentMethodMap[order.payment_method] || order.payment_method;

    // Format order type
    const orderType = order.order_type || 'delivery';
    const orderTypeLabel = ORDER_TYPE_LABELS[orderType] || ORDER_TYPE_LABELS.delivery;

    // Build location info based on order type
    let locationInfo = '';
    if (orderType === 'delivery') {
      const mapsLink = order.delivery_lat && order.delivery_lng
        ? `\n📌 https://www.google.com/maps/search/?api=1&query=${order.delivery_lat},${order.delivery_lng}`
        : '';
      locationInfo = `📍 *Entrega:* ${order.delivery_address}${mapsLink}`;
    } else if (orderType === 'dine_in') {
      locationInfo = order.table_number 
        ? `🍽️ *Mesa:* ${order.table_number}`
        : '🍽️ Consumo no Local';
    } else if (orderType === 'takeaway') {
      locationInfo = '🛍️ *Retirada:* No balcão';
    }

    // Build customer message
    const shortOrderId = order_id.substring(0, 8).toUpperCase();
    const message = `✅ *Pedido #${shortOrderId} Confirmado!*

Olá ${order.customer_name}! 👋

Seu pedido no *${restaurant.name}* foi recebido com sucesso.

📦 *Tipo:* ${orderTypeLabel}

📋 *Itens:*
${itemsText}

💰 *Total:* €${order.total_amount.toFixed(2)}
${locationInfo}
💳 *Pagamento:* ${paymentText}

⏰ Tempo estimado: 30-45 minutos

Obrigado pela preferência! 🍕`;

    console.log(`[notify-customer-order] Sending message to customer ${order.customer_phone} via instance ${instance.instance_name}`);

    // Send WhatsApp message to customer
    const evolutionApiUrlRaw = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionApiUrl = evolutionApiUrlRaw?.replace(/\/+$/, '') || null;

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('[notify-customer-order] Evolution API not configured');
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number for WhatsApp
    let formattedPhone = order.customer_phone.replace(/\D/g, '');
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
      console.error('[notify-customer-order] Failed to send WhatsApp message:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp message', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionData = await evolutionResponse.json();
    console.log('[notify-customer-order] WhatsApp message sent successfully:', evolutionData);

    // Log the outbound message
    await supabase
      .from('messages')
      .insert({
        restaurant_id: restaurant_id,
        from_number: 'system',
        to_number: order.customer_phone,
        body: message,
        direction: 'outbound',
        sent_by: 'system',
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Customer notification sent',
        order_id: order_id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[notify-customer-order] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
