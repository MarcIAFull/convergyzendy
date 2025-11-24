import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendWhatsAppMessage } from "../_shared/evolutionClient.ts";
import { validateRestaurantAccess, unauthorizedResponse } from "../_shared/authMiddleware.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  restaurantId: string;
  customerPhone: string;
  messageText: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { restaurantId, customerPhone, messageText }: SendMessageRequest = await req.json();

    if (!restaurantId || !customerPhone || !messageText) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: restaurantId, customerPhone, messageText' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate authentication and restaurant access
    const authHeader = req.headers.get('Authorization');
    const authResult = await validateRestaurantAccess(
      supabaseUrl,
      supabaseKey,
      authHeader,
      restaurantId
    );

    if (!authResult.authorized) {
      console.error('[WhatsAppSend] Authorization failed:', authResult.error);
      return unauthorizedResponse(authResult.error || 'Unauthorized', corsHeaders);
    }

    console.log(`[WhatsAppSend] User ${authResult.userId} authorized for restaurant ${restaurantId}`);

    // Fetch restaurant details and instance
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('phone')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error('Restaurant not found');
    }

    // Get the restaurant's WhatsApp instance
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, status')
      .eq('restaurant_id', restaurantId)
      .single();

    if (instanceError || !instance) {
      throw new Error('WhatsApp not configured for this restaurant');
    }

    if (instance.status !== 'connected') {
      throw new Error('WhatsApp not connected. Please connect first.');
    }

    console.log(`[whatsapp-send] Sending message to ${customerPhone} via instance ${instance.instance_name}`);

    // Send the message using Evolution API with restaurant's instance
    const evolutionData = await sendWhatsAppMessage(instance.instance_name, customerPhone, messageText);

    // Log outbound message to database
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        restaurant_id: restaurantId,
        from_number: restaurant.phone,
        to_number: customerPhone,
        body: messageText,
        direction: 'outbound',
      });

    if (messageError) {
      console.error('Error saving outbound message:', messageError);
      // Don't throw error here - message was sent successfully
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message sent successfully',
        evolutionResponse: evolutionData 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to send message' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
