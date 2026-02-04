import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GLOVO_STAGING_URL = 'https://ondemand-stageapi.glovoapp.com';
const GLOVO_PRODUCTION_URL = 'https://ondemand-api.glovoapp.com';

async function getGlovoToken(supabase: any, restaurantId: string): Promise<{ token: string; baseUrl: string } | null> {
  const { data: config } = await supabase
    .from('restaurant_glovo_config')
    .select('access_token, token_expires_at, environment')
    .eq('restaurant_id', restaurantId)
    .single();

  if (!config?.access_token) return null;

  // Check if token is still valid (with 5 min buffer)
  const expiresAt = new Date(config.token_expires_at);
  const now = new Date();
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    return null; // Token expired or about to expire
  }

  const baseUrl = config.environment === 'production' 
    ? GLOVO_PRODUCTION_URL 
    : GLOVO_STAGING_URL;

  return { token: config.access_token, baseUrl };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, restaurantId } = body;

    // Verify user has access to restaurant
    const { data: access } = await supabase
      .from('restaurant_owners')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user.id)
      .single();

    if (!access) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get token
    const tokenInfo = await getGlovoToken(supabase, restaurantId);
    if (!tokenInfo) {
      return new Response(JSON.stringify({ 
        error: 'Glovo token not available. Please reconnect.',
        needsReconnect: true 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { token, baseUrl } = tokenInfo;

    // Handle different actions
    if (action === 'quote') {
      const { orderId, pickupAddress, deliveryAddress } = body;

      // Get config for pickup details
      const { data: config } = await supabase
        .from('restaurant_glovo_config')
        .select('pickup_latitude, pickup_longitude, pickup_address, address_book_id')
        .eq('restaurant_id', restaurantId)
        .single();

      const pickup = pickupAddress || {
        latitude: config?.pickup_latitude,
        longitude: config?.pickup_longitude,
        address: config?.pickup_address,
      };

      if (!pickup.latitude || !pickup.longitude) {
        return new Response(JSON.stringify({ 
          error: 'Pickup address not configured' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const quotePayload = {
        pickUpLocation: {
          lat: pickup.latitude,
          lon: pickup.longitude,
          label: pickup.address || 'Restaurant',
        },
        deliveryLocation: {
          lat: deliveryAddress.latitude,
          lon: deliveryAddress.longitude,
          label: deliveryAddress.address,
        },
      };

      const quoteResponse = await fetch(`${baseUrl}/v2/laas/quotes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quotePayload),
      });

      if (!quoteResponse.ok) {
        const errorText = await quoteResponse.text();
        console.error('Glovo quote error:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Failed to get delivery quote',
          details: errorText 
        }), {
          status: quoteResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const quoteData = await quoteResponse.json();

      return new Response(JSON.stringify({
        success: true,
        quote: {
          quoteId: quoteData.id,
          estimatedPrice: quoteData.price?.amount || quoteData.estimatedPrice,
          currency: quoteData.price?.currency || 'EUR',
          estimatedPickupTime: quoteData.estimatedPickUpTime,
          estimatedDeliveryTime: quoteData.estimatedDeliveryTime,
          expiresAt: quoteData.expiresAt,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create') {
      const { 
        quoteId, 
        orderId, 
        customerName, 
        customerPhone, 
        orderDescription,
        pickupInstructions,
        deliveryInstructions,
        deliveryAddress,
      } = body;

      // Get config
      const { data: config } = await supabase
        .from('restaurant_glovo_config')
        .select('pickup_latitude, pickup_longitude, pickup_address, pickup_phone, address_book_id')
        .eq('restaurant_id', restaurantId)
        .single();

      const parcelPayload = {
        quoteId,
        description: orderDescription || `Order #${orderId.slice(0, 8)}`,
        pickUp: {
          location: {
            lat: config?.pickup_latitude,
            lon: config?.pickup_longitude,
            label: config?.pickup_address,
          },
          contactPhone: config?.pickup_phone,
          pickUpInstructions: pickupInstructions,
        },
        delivery: {
          location: {
            lat: deliveryAddress.latitude,
            lon: deliveryAddress.longitude,
            label: deliveryAddress.address,
            details: deliveryAddress.details,
          },
          contactPhone: customerPhone,
          contactName: customerName,
          deliveryInstructions: deliveryInstructions,
        },
      };

      const createResponse = await fetch(`${baseUrl}/v2/laas/parcels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parcelPayload),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Glovo create delivery error:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Failed to create delivery',
          details: errorText 
        }), {
          status: createResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const deliveryData = await createResponse.json();

      // Save to database
      const { data: glovoDelivery, error: insertError } = await supabase
        .from('glovo_deliveries')
        .insert({
          order_id: orderId,
          restaurant_id: restaurantId,
          tracking_number: deliveryData.trackingNumber,
          order_code: deliveryData.orderCode,
          quote_id: quoteId,
          quote_price: deliveryData.price?.amount,
          status: deliveryData.status || 'CREATED',
          tracking_link: deliveryData.trackingLink,
          estimated_pickup_at: deliveryData.estimatedPickUpTime,
          estimated_delivery_at: deliveryData.estimatedDeliveryTime,
          raw_response: deliveryData,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error saving delivery:', insertError);
      }

      // Update order delivery_provider
      await supabase
        .from('orders')
        .update({ delivery_provider: 'glovo' })
        .eq('id', orderId);

      return new Response(JSON.stringify({
        success: true,
        delivery: {
          id: glovoDelivery?.id,
          trackingNumber: deliveryData.trackingNumber,
          orderCode: deliveryData.orderCode,
          status: deliveryData.status || 'CREATED',
          trackingLink: deliveryData.trackingLink,
          estimatedPickupAt: deliveryData.estimatedPickUpTime,
          estimatedDeliveryAt: deliveryData.estimatedDeliveryTime,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'cancel') {
      const { trackingNumber, reason } = body;

      const cancelResponse = await fetch(`${baseUrl}/v2/laas/parcels/${trackingNumber}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason || 'Cancelled by merchant' }),
      });

      if (!cancelResponse.ok) {
        const errorText = await cancelResponse.text();
        console.error('Glovo cancel error:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Failed to cancel delivery',
          details: errorText 
        }), {
          status: cancelResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update database
      await supabase
        .from('glovo_deliveries')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        })
        .eq('tracking_number', trackingNumber);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      const { trackingNumber } = body;

      const statusResponse = await fetch(`${baseUrl}/v2/laas/parcels/${trackingNumber}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        return new Response(JSON.stringify({ 
          error: 'Failed to get delivery status',
          details: errorText 
        }), {
          status: statusResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const statusData = await statusResponse.json();

      // Update local record
      await supabase
        .from('glovo_deliveries')
        .update({
          status: statusData.status,
          courier_name: statusData.courier?.name,
          courier_phone: statusData.courier?.phone,
          courier_latitude: statusData.courier?.location?.lat,
          courier_longitude: statusData.courier?.location?.lon,
          picked_at: statusData.status === 'PICKED' ? new Date().toISOString() : undefined,
          delivered_at: statusData.status === 'DELIVERED' ? new Date().toISOString() : undefined,
          raw_response: statusData,
        })
        .eq('tracking_number', trackingNumber);

      return new Response(JSON.stringify({
        success: true,
        status: statusData.status,
        courier: statusData.courier,
        trackingLink: statusData.trackingLink,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-delivery') {
      const { orderId } = body;

      const { data: delivery } = await supabase
        .from('glovo_deliveries')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return new Response(JSON.stringify({
        success: true,
        delivery,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Glovo delivery error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
