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

    // Fetch order from orders table
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_phone, delivery_address, status')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('[notify-order-status] Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine customer phone: try orders.user_phone first, then web_orders.customer_phone
    let customerPhone = order.user_phone;

    // Check if this is a web order (web_orders links via order_id or similar)
    const { data: webOrder } = await supabase
      .from('web_orders')
      .select('customer_phone, customer_name, order_type')
      .eq('id', order_id)
      .maybeSingle();

    // If web order has a different phone, use that
    if (webOrder?.customer_phone) {
      customerPhone = webOrder.customer_phone;
    }

    if (!customerPhone) {
      console.error('[notify-order-status] No customer phone found');
      return new Response(
        JSON.stringify({ error: 'No customer phone found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine order type for context-aware messages
    const orderType = webOrder?.order_type || (order.delivery_address && order.delivery_address !== 'N/A' ? 'delivery' : 'takeaway');
    const shortOrderId = order_id.substring(0, 8).toUpperCase();
    const customerName = webOrder?.customer_name || '';

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
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

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
