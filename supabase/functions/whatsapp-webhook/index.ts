import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[EvolutionWebhook] Incoming request', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[EvolutionWebhook] CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // GET request for webhook verification (if Evolution uses this)
    if (req.method === 'GET') {
      console.log('[EvolutionWebhook] GET request received');
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('[EvolutionWebhook] Verification params:', { mode, token, challenge });

      const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'your_verify_token';

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('[EvolutionWebhook] Webhook verified successfully');
        return new Response(challenge, { status: 200 });
      } else {
        console.log('[EvolutionWebhook] Webhook verification failed');
        return new Response('Forbidden', { status: 403 });
      }
    }

    // POST request for incoming messages
    if (req.method === 'POST') {
      let body;
      try {
        const rawBody = await req.text();
        console.log('[EvolutionWebhook] Raw body:', rawBody);
        body = JSON.parse(rawBody);
        console.log('[EvolutionWebhook] Parsed body:', JSON.stringify(body, null, 2));
      } catch (parseError) {
        console.error('[EvolutionWebhook] Failed to parse body:', parseError);
        return new Response(JSON.stringify({ ok: true, error: 'Invalid JSON' }), {
          status: 200, // Return 200 to avoid Evolution retries
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Parse Evolution API webhook payload
      // Evolution can send different event types and formats
      const event = body.event;
      const data = body.data;

      console.log('[EvolutionWebhook] Event type:', event);
      console.log('[EvolutionWebhook] Data:', JSON.stringify(data, null, 2));

      // Only process incoming messages
      if (event !== 'messages.upsert' || !data) {
        console.log('[EvolutionWebhook] Ignoring event (not messages.upsert or no data)');
        return new Response(JSON.stringify({ ok: true, note: 'Not a message event' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Check if this is an outbound message (sent by us)
      if (data.key?.fromMe === true) {
        console.log('[EvolutionWebhook] Ignoring outbound message');
        return new Response(JSON.stringify({ ok: true, note: 'Outbound message' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Extract phone number (remove @s.whatsapp.net suffix)
      const remoteJid = data.key?.remoteJid || '';
      let from = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      
      // Ensure E.164 format (add + if not present)
      if (from && !from.startsWith('+')) {
        from = '+' + from;
      }
      
      // Extract message text (Evolution supports multiple message types)
      const messageBody = 
        data.message?.conversation || 
        data.message?.extendedTextMessage?.text || 
        data.message?.imageMessage?.caption ||
        '';

      console.log('[EvolutionWebhook] Extracted data:', {
        from,
        messageBody,
        hasMessage: !!messageBody,
      });

      if (!messageBody) {
        console.log('[EvolutionWebhook] No text content in message');
        return new Response(JSON.stringify({ ok: true, note: 'No text content' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      console.log(`[EvolutionWebhook] Test message received`, { phone: from, text: messageBody });

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

      // Check for opt-out keywords (spam prevention)
      await checkOptOut(supabase, restaurant.id, from, messageBody);

      // Call AI ordering agent (handles state machine, tools, and sends reply)
      console.log('[EvolutionWebhook] Calling whatsapp-ai-agent function');
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
          // Don't throw - log and return success to Evolution
          return new Response(JSON.stringify({ ok: true, error: 'AI agent failed', details: aiError }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
        
        console.log('[EvolutionWebhook] AI agent response:', aiResponse);
        console.log('[EvolutionWebhook] Reply sent via Evolution API');
      } catch (aiError) {
        console.error('[EvolutionWebhook] AI agent error:', aiError);
        // Don't throw - log and return success to Evolution
        return new Response(JSON.stringify({ ok: true, error: 'AI agent exception', details: String(aiError) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('[EvolutionWebhook] Webhook error:', error);
    console.error('[EvolutionWebhook] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    // Always return 200 to Evolution to avoid retries
    return new Response(JSON.stringify({ ok: true, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Opt-out detection function
async function checkOptOut(supabase: any, restaurantId: string, customerPhone: string, messageBody: string) {
  const optOutKeywords = [
    'não quero',
    'nao quero',
    'deixa quieto',
    'para de enviar',
    'para',
    'stop',
    'cancelar',
    'não me mande',
    'nao me mande',
    'não envie',
    'nao envie',
    'desinscrever',
    'remover',
    'sair',
    'chega',
    'basta'
  ];

  const lowerMessage = messageBody.toLowerCase();
  const hasOptOutKeyword = optOutKeywords.some(keyword => lowerMessage.includes(keyword));

  if (!hasOptOutKeyword) {
    return;
  }

  console.log(`[OptOut] Customer ${customerPhone} requested opt-out with message: "${messageBody}"`);

  // Mark all pending and sent recovery attempts as expired
  const { error: updateError } = await supabase
    .from('conversation_recovery_attempts')
    .update({ 
      status: 'expired',
      metadata: supabase.rpc('jsonb_set', {
        target: 'metadata',
        path: '{opt_out_message}',
        new_value: JSON.stringify(messageBody)
      })
    })
    .eq('restaurant_id', restaurantId)
    .eq('user_phone', customerPhone)
    .in('status', ['pending', 'sent']);

  if (updateError) {
    console.error('[OptOut] Error updating recovery attempts:', updateError);
  } else {
    console.log(`[OptOut] Marked all recovery attempts as expired for ${customerPhone}`);
  }
}
