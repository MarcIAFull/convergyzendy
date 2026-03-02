import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyStatusRequest {
  order_id: string;
  restaurant_id: string;
  new_status: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { order_id, restaurant_id, new_status }: NotifyStatusRequest = await req.json();

    if (!order_id || !restaurant_id || !new_status) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id, restaurant_id, or new_status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[notify-order-status] Order ${order_id} -> ${new_status}`);

    // Try to find the order in both tables
    let customerPhone: string | null = null;
    let orderType = 'delivery';
    let customerName = '';
    let deliveryAddress = '';

    // Check orders table first (WhatsApp orders)
    const { data: order } = await supabase
      .from('orders')
      .select('id, user_phone, delivery_address, status')
      .eq('id', order_id)
      .maybeSingle();

    if (order) {
      customerPhone = order.user_phone;
      deliveryAddress = order.delivery_address;
      orderType = deliveryAddress && deliveryAddress !== 'N/A' ? 'delivery' : 'takeaway';
    }

    // Check web_orders table (web orders)
    const { data: webOrder } = await supabase
      .from('web_orders')
      .select('customer_phone, customer_name, order_type, delivery_address')
      .eq('id', order_id)
      .maybeSingle();

    if (webOrder) {
      customerPhone = webOrder.customer_phone;
      customerName = webOrder.customer_name || '';
      orderType = webOrder.order_type || 'delivery';
    }

    if (!customerPhone) {
      console.error('[notify-order-status] No customer phone found');
      return new Response(
        JSON.stringify({ error: 'No customer phone found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const shortOrderId = order_id.substring(0, 8).toUpperCase();

    // Build status message
    const message = buildStatusMessage(new_status, shortOrderId, orderType, customerName);

    if (!message) {
      console.log(`[notify-order-status] No message configured for status: ${new_status}`);
      return new Response(
        JSON.stringify({ success: true, message: 'No notification for this status' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch WhatsApp instance
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, status')
      .eq('restaurant_id', restaurant_id)
      .single();

    if (!instance || instance.status !== 'connected') {
      console.error('[notify-order-status] WhatsApp not connected');
      return new Response(
        JSON.stringify({ error: 'WhatsApp not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send via Evolution API
    const evolutionApiUrlRaw = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionApiUrl = evolutionApiUrlRaw?.replace(/\/+$/, '') || null;

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('[notify-order-status] Evolution API not configured');
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedPhone = customerPhone.replace(/\D/g, '');
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
      console.error('[notify-order-status] Failed to send:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp message', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionData = await evolutionResponse.json();
    console.log('[notify-order-status] Message sent successfully:', evolutionData);

    // Log outbound message
    await supabase
      .from('messages')
      .insert({
        restaurant_id,
        from_number: 'system',
        to_number: customerPhone,
        body: message,
        direction: 'outbound',
        sent_by: 'system',
      });

    return new Response(
      JSON.stringify({ success: true, message: 'Status notification sent', order_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[notify-order-status] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildStatusMessage(
  status: string,
  shortOrderId: string,
  orderType: string,
  customerName: string
): string | null {
  const greeting = customerName ? `Olá ${customerName}! ` : '';

  switch (status) {
    case 'preparing':
      return `👨‍🍳 ${greeting}Seu pedido *#${shortOrderId}* está sendo preparado! Aguarde... ⏳`;

    case 'ready':
      if (orderType === 'delivery') {
        return `✅ ${greeting}Seu pedido *#${shortOrderId}* está pronto e aguardando o entregador! 🚚`;
      }
      if (orderType === 'dine_in') {
        return `🍽️ ${greeting}Seu pedido *#${shortOrderId}* está pronto! Pode retirar no balcão. 😊`;
      }
      // takeaway
      return `✅ ${greeting}Seu pedido *#${shortOrderId}* está pronto para retirada! 🛍️`;

    case 'delivering':
      return `🚚 ${greeting}Seu pedido *#${shortOrderId}* saiu para entrega! Em breve estará aí! 📍`;

    case 'delivered':
      return `🎉 ${greeting}Seu pedido *#${shortOrderId}* foi entregue! Obrigado pela preferência! ❤️`;

    case 'cancelled':
      return `❌ ${greeting}Seu pedido *#${shortOrderId}* foi cancelado. Entre em contato para mais informações.`;

    default:
      return null;
  }
}
