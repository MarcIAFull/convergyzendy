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
      console.log('[EvolutionWebhook] Incoming payload:', JSON.stringify(body, null, 2));

      // Parse Evolution API webhook payload
      // Evolution sends: { event: "messages.upsert", instance: "...", data: { key, message, ... } }
      const event = body.event;
      const data = body.data;

      // Only process incoming messages
      if (event !== 'messages.upsert' || !data || data.key?.fromMe) {
        console.log('[EvolutionWebhook] Ignoring non-message or outbound event');
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Extract phone number (remove @s.whatsapp.net suffix)
      const remoteJid = data.key?.remoteJid || '';
      const from = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      
      // Extract message text (Evolution supports multiple message types)
      const messageBody = 
        data.message?.conversation || 
        data.message?.extendedTextMessage?.text || 
        data.message?.imageMessage?.caption ||
        '';

      if (!messageBody) {
        console.log('[EvolutionWebhook] No text content in message');
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[EvolutionWebhook] Normalized phone: ${from}, text: ${messageBody}`);

      // Find restaurant by instance name (single-tenant setup)
      // In a multi-tenant setup, you'd match by phone number from Evolution instance config
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, name, phone')
        .limit(1)
        .maybeSingle();

      if (restaurantError) {
        console.error('[EvolutionWebhook] Error finding restaurant:', restaurantError);
        throw restaurantError;
      }

      if (!restaurant) {
        console.log('[EvolutionWebhook] No restaurant found');
        return new Response(JSON.stringify({ success: true, note: 'Restaurant not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Save inbound message to database
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          restaurant_id: restaurant.id,
          from_number: from,
          to_number: restaurant.phone,
          body: messageBody,
          direction: 'inbound',
        });

      if (messageError) {
        console.error('[EvolutionWebhook] Error saving message:', messageError);
        throw messageError;
      }

      console.log('[EvolutionWebhook] Message saved to database');

      // Call AI ordering agent (handles state machine, tools, and sends reply)
      console.log('[EvolutionWebhook] Calling handleIncomingWhatsAppMessage via whatsapp-ai-agent');
      try {
        const { data: aiResponse, error: aiError } = await supabase.functions.invoke('whatsapp-ai-agent', {
          body: {
            restaurantId: restaurant.id,
            customerPhone: from,
            messageBody: messageBody,
          },
        });

        if (aiError) {
          console.error('[EvolutionWebhook] Error calling AI agent:', aiError);
          throw aiError;
        }
        
        console.log('[EvolutionWebhook] AI agent processed message successfully');
        console.log('[EvolutionWebhook] Reply sent via Evolution API');
      } catch (aiError) {
        console.error('[EvolutionWebhook] AI agent error:', aiError);
        throw aiError;
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
