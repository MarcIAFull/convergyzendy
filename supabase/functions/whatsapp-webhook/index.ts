import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // GET request for webhook verification
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'your_verify_token';

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('Webhook verified');
        return new Response(challenge, { status: 200 });
      } else {
        return new Response('Forbidden', { status: 403 });
      }
    }

    // POST request for incoming messages
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Webhook received:', JSON.stringify(body, null, 2));

      // Parse WhatsApp webhook payload
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) {
        console.log('No messages in webhook');
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const message = messages[0];
      const from = message.from; // Customer phone number
      const messageBody = message.text?.body || '';
      const messageId = message.id;
      const timestamp = message.timestamp;

      // Get business phone number from metadata
      const businessPhoneId = value?.metadata?.phone_number_id;
      const displayPhoneNumber = value?.metadata?.display_phone_number;

      console.log(`Message from ${from}: ${messageBody}`);

      // Find restaurant by phone number
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, name, phone')
        .eq('phone', displayPhoneNumber)
        .maybeSingle();

      if (restaurantError) {
        console.error('Error finding restaurant:', restaurantError);
        throw restaurantError;
      }

      if (!restaurant) {
        console.log(`No restaurant found for phone ${displayPhoneNumber}`);
        return new Response(JSON.stringify({ success: true, note: 'Restaurant not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Save message to database
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          restaurant_id: restaurant.id,
          from_number: from,
          to_number: displayPhoneNumber,
          body: messageBody,
          direction: 'inbound',
        });

      if (messageError) {
        console.error('Error saving message:', messageError);
        throw messageError;
      }

      console.log('Message saved to database');

      // TODO: Forward to AI agent function
      // This will be implemented in the next step
      try {
        const { data: aiResponse, error: aiError } = await supabase.functions.invoke('whatsapp-ai-agent', {
          body: {
            restaurantId: restaurant.id,
            customerPhone: from,
            messageBody: messageBody,
          },
        });

        if (aiError) {
          console.error('Error calling AI agent:', aiError);
        } else {
          console.log('AI agent response:', aiResponse);
        }
      } catch (aiError) {
        console.error('AI agent not available yet:', aiError);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
