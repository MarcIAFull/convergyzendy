import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

    // Get restaurant details
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('phone')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      console.error('Restaurant not found:', restaurantError);
      return new Response(
        JSON.stringify({ error: 'Restaurant not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get Evolution API credentials
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstanceName) {
      console.error('Evolution API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'WhatsApp service not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Format phone number for WhatsApp (remove + and add @s.whatsapp.net)
    const formattedPhone = customerPhone.replace(/\+/g, '') + '@s.whatsapp.net';

    console.log(`Sending message to ${formattedPhone} via Evolution API`);

    // Send message via Evolution API
    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/message/sendText/${evolutionInstanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: messageText,
        }),
      }
    );

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('Evolution API error:', evolutionResponse.status, errorText);
      throw new Error(`Failed to send message via Evolution API: ${errorText}`);
    }

    const evolutionData = await evolutionResponse.json();
    console.log('Message sent successfully:', evolutionData);

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
