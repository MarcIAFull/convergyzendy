import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Glovo sends webhook with Authorization header containing partnerSecret
    const authHeader = req.headers.get('Authorization');
    
    const payload = await req.json();
    console.log('Glovo webhook received:', JSON.stringify(payload));

    const { 
      type, 
      trackingNumber, 
      orderCode,
      status,
      courier,
      timestamp,
    } = payload;

    if (!trackingNumber) {
      return new Response(JSON.stringify({ error: 'Missing trackingNumber' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get existing delivery record
    const { data: delivery, error: fetchError } = await supabase
      .from('glovo_deliveries')
      .select('id, order_id, restaurant_id')
      .eq('tracking_number', trackingNumber)
      .single();

    if (fetchError || !delivery) {
      console.error('Delivery not found:', trackingNumber);
      return new Response(JSON.stringify({ error: 'Delivery not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Optionally validate webhook secret
    if (authHeader) {
      const { data: config } = await supabase
        .from('restaurant_glovo_config')
        .select('webhook_secret')
        .eq('restaurant_id', delivery.restaurant_id)
        .single();

      if (config?.webhook_secret && authHeader !== config.webhook_secret) {
        console.warn('Webhook secret mismatch for restaurant:', delivery.restaurant_id);
        // Continue anyway for flexibility, but log the warning
      }
    }

    // Handle different webhook types
    if (type === 'STATUS_UPDATE' && status) {
      const updateData: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };

      // Set timestamps based on status
      switch (status) {
        case 'PICKED':
          updateData.picked_at = timestamp || new Date().toISOString();
          break;
        case 'DELIVERED':
          updateData.delivered_at = timestamp || new Date().toISOString();
          break;
        case 'CANCELLED':
          updateData.cancelled_at = timestamp || new Date().toISOString();
          break;
      }

      // Update courier info if provided
      if (courier) {
        updateData.courier_name = courier.name;
        updateData.courier_phone = courier.phone;
        if (courier.location) {
          updateData.courier_latitude = courier.location.lat;
          updateData.courier_longitude = courier.location.lon;
        }
      }

      await supabase
        .from('glovo_deliveries')
        .update(updateData)
        .eq('id', delivery.id);

      // If delivered, update order status to completed
      if (status === 'DELIVERED') {
        await supabase
          .from('orders')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', delivery.order_id);
      }

      // If cancelled, we might want to notify the restaurant
      // For now, just log it
      if (status === 'CANCELLED') {
        console.log('Glovo delivery cancelled:', trackingNumber);
      }
    }

    if (type === 'POSITION_UPDATE' && courier?.location) {
      await supabase
        .from('glovo_deliveries')
        .update({
          courier_latitude: courier.location.lat,
          courier_longitude: courier.location.lon,
          courier_name: courier.name || undefined,
          courier_phone: courier.phone || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', delivery.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Glovo webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
