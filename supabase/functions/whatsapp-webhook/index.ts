import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  createErrorHttpResponse, 
  createSuccessHttpResponse, 
  extractErrorMessage, 
  logError,
  ErrorCodes 
} from '../_shared/errorHandler.ts';
import { 
  checkRateLimit, 
  RateLimits, 
  createRateLimitIdentifier, 
  logRateLimitHit 
} from '../_shared/rateLimiter.ts';

// Declare EdgeRuntime global for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {

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

      // Extract data from the webhook
      const event = body.event;
      const instanceName = body.instance;
      const data = body.data;

      // Get restaurant ID from instance name
      const { data: instance, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('restaurant_id')
        .eq('instance_name', instanceName)
        .single();

      if (instanceError || !instance) {
        logError('whatsapp-webhook', `Instance not found: ${instanceName}`, { instanceError });
        return createErrorHttpResponse(
          'WhatsApp instance not found',
          404,
          ErrorCodes.NOT_FOUND,
          corsHeaders
        );
      }

      const restaurantId = instance.restaurant_id;
      console.log('[whatsapp-webhook] Routing to restaurant:', restaurantId);
      console.log('[whatsapp-webhook] Event type:', event);
      console.log('[whatsapp-webhook] Data:', JSON.stringify(data, null, 2));

      // Handle connection.update events
      if (event === 'connection.update') {
        const connectionState = data.state; // 'open', 'connecting', 'qr', 'close', 'refused'
        const statusReason = data.statusReason;
        
        console.log(`[whatsapp-webhook] Connection update: state=${connectionState}, reason=${statusReason}`);
        
        let mappedStatus = 'disconnected';
        
        if (connectionState === 'open') {
          mappedStatus = 'connected';
        } else if (connectionState === 'connecting' || connectionState === 'qr') {
          mappedStatus = 'waiting_qr';
        } else if (connectionState === 'close' || connectionState === 'refused') {
          mappedStatus = 'disconnected';
        }
        
        // Update status in database in real-time
        const { error: updateError } = await supabase
          .from('whatsapp_instances')
          .update({
            status: mappedStatus,
            last_connected_at: mappedStatus === 'connected' ? new Date().toISOString() : null,
            last_checked_at: new Date().toISOString(),
            metadata: { connectionState, statusReason, updatedViaWebhook: true }
          })
          .eq('instance_name', instanceName);
        
        if (updateError) {
          console.error('[whatsapp-webhook] Failed to update instance status:', updateError);
        }
        
        // Log system event
        await supabase
          .from('system_logs')
          .insert({
            restaurant_id: restaurantId,
            log_type: 'whatsapp_connection',
            severity: mappedStatus === 'connected' ? 'info' : (connectionState === 'refused' ? 'error' : 'warn'),
            message: `WhatsApp ${mappedStatus} (state: ${connectionState}, reason: ${statusReason})`,
            metadata: { connectionState, statusReason, instanceName }
          });
        
        console.log(`[whatsapp-webhook] Status updated to: ${mappedStatus}`);
        
        return new Response(JSON.stringify({ ok: true, status: mappedStatus }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Only process incoming messages
      if (event !== 'messages.upsert' || !data) {
        console.log('[EvolutionWebhook] Ignoring event (not messages.upsert or connection.update)');
        return new Response(JSON.stringify({ ok: true, note: 'Event not processed' }), {
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

      // Extract phone number - preserve the full remoteJid for @lid support
      const remoteJid = data.key?.remoteJid || '';
      let from = remoteJid;
      
      console.log(`[EvolutionWebhook] Raw remoteJid: "${remoteJid}"`);
      
      // Detect the type of identifier
      const isLid = remoteJid.includes('@lid');
      const isWhatsAppNet = remoteJid.includes('@s.whatsapp.net');
      const isCUs = remoteJid.includes('@c.us');
      
      // ============================================================
      // FASE 1: @LID DETECTION - Force manual mode immediately
      // @lid identifiers cannot receive replies, must escalate to human
      // ============================================================
      if (isLid) {
        // @lid format: preserve full identifier including @lid suffix
        // This is a Linked ID from WhatsApp Business - CANNOT RECEIVE REPLIES
        from = remoteJid.replace(/^\+/, ''); // Just remove + if present
        console.log(`[EvolutionWebhook] 🔗 LID format detected, preserved: "${from}"`);
        console.log(`[EvolutionWebhook] ⚠️ @lid numbers cannot receive AI replies - forcing manual mode`);
      } else if (isWhatsAppNet || isCUs) {
        // Standard format: extract number, add + prefix
        from = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
        if (from && !from.startsWith('+')) {
          from = '+' + from;
        }
        console.log(`[EvolutionWebhook] 📱 Standard format, extracted: "${from}"`);
      } else {
        // Unknown format - just add + if needed
        if (from && !from.startsWith('+')) {
          from = '+' + from;
        }
        console.log(`[EvolutionWebhook] ❓ Unknown format, normalized: "${from}"`);
      }
      
      // Extract message text (Evolution supports multiple message types)
      let messageBody = 
        data.message?.conversation || 
        data.message?.extendedTextMessage?.text || 
        data.message?.imageMessage?.caption ||
        '';

      // Check for location message (WhatsApp GPS location share)
      const locationMessage = data.message?.locationMessage;
      if (locationMessage) {
        const lat = locationMessage.degreesLatitude;
        const lng = locationMessage.degreesLongitude;
        const locationName = locationMessage.name || '';
        const locationAddress = locationMessage.address || '';
        
        console.log('[EvolutionWebhook] 📍 Location message detected:', {
          lat,
          lng,
          name: locationName,
          address: locationAddress
        });
        
        // Format location as special message for AI to recognize
        const locationDetails = [
          locationName && `nome="${locationName}"`,
          locationAddress && `endereço="${locationAddress}"`
        ].filter(Boolean).join(', ');
        
        messageBody = `[LOCALIZAÇÃO GPS: lat=${lat}, lng=${lng}${locationDetails ? ', ' + locationDetails : ''}]`;
        console.log('[EvolutionWebhook] 📍 Formatted location message:', messageBody);
      }

      console.log('[EvolutionWebhook] Extracted data:', {
        from,
        messageBody,
        hasMessage: !!messageBody,
        isLocation: !!locationMessage,
      });

      if (!messageBody) {
        console.log('[EvolutionWebhook] No text content in message');
        return new Response(JSON.stringify({ ok: true, note: 'No text content' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      console.log(`[whatsapp-webhook] Processing message from ${from} for restaurant ${restaurantId}`);

      // ============================================================
      // FASE 1: @LID DETECTION - Skip AI, force manual mode
      // ============================================================
      if (isLid) {
        console.log(`[whatsapp-webhook] ⚠️ @lid detected - skipping AI, forcing manual mode`);
        
        // Save message to database first (use restaurantId since we don't have restaurant phone yet)
        await supabase
          .from('messages')
          .insert({
            restaurant_id: restaurantId,
            from_number: from,
            to_number: 'unknown', // We don't have restaurant phone at this point
            body: messageBody,
            direction: 'inbound',
          });
        
        // Force manual mode for this conversation
        await supabase
          .from('conversation_mode')
          .upsert({
            restaurant_id: restaurantId,
            user_phone: from,
            mode: 'manual',
            handoff_reason: '@lid_number_detected',
            handoff_summary: `Número @lid detectado: ${from}. Não é possível enviar respostas automáticas para este número. Requer atendimento manual.`,
            taken_over_at: new Date().toISOString(),
          }, {
            onConflict: 'restaurant_id,user_phone'
          });
        
        // Create urgent system log for staff notification
        await supabase
          .from('system_logs')
          .insert({
            restaurant_id: restaurantId,
            log_type: 'lid_customer_alert',
            severity: 'warn',
            message: `⚠️ Cliente com número @lid detectado: ${from}. Mensagem: "${messageBody.substring(0, 100)}..."`,
            metadata: { 
              customer_phone: from, 
              message_preview: messageBody.substring(0, 200),
              requires_manual_attention: true
            }
          });
        
        return new Response(JSON.stringify({ 
          ok: true, 
          skipped: true,
          reason: 'lid_number_cannot_receive_replies',
          message: 'Número @lid detectado - conversa movida para modo manual'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Rate limiting check
      const rateLimitKey = createRateLimitIdentifier('webhook', restaurantId, from);
      const rateLimit = checkRateLimit({
        ...RateLimits.WEBHOOK_PER_CUSTOMER,
        identifier: rateLimitKey,
      });

      if (!rateLimit.allowed) {
        logRateLimitHit(rateLimitKey, rateLimit.remaining, rateLimit.resetTime);
        return createErrorHttpResponse(
          'Você está enviando mensagens muito rápido. Aguarde alguns momentos.',
          429,
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          corsHeaders
        );
      }

      // Get restaurant info
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, phone')
        .eq('id', restaurantId)
        .single();

      if (!restaurant) {
        console.error('[whatsapp-webhook] Restaurant not found:', restaurantId);
        return new Response(JSON.stringify({ success: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

      // Add message to debounce queue and schedule processing
      console.log('[whatsapp-webhook] Adding message to debounce queue');
      let result: { id: string; action: string; message_count: number } | null = null;
      try {
        result = await addToDebounceQueue(
          supabase,
          restaurant.id,
          from,
          messageBody,
          instanceName
        );
        const queueId = result?.id;

        if (queueId) {
          const action = result?.action || 'unknown';
          console.log(`[whatsapp-webhook] Message added to debounce queue: ${queueId} (action: ${action})`);
          
          // CORREÇÃO: Só agendar processamento quando queue é CRIADA, não atualizada
          // Isso evita múltiplos timers para o mesmo queueId
          if (action === 'created') {
            console.log(`[whatsapp-webhook] Queue CREATED - starting single timer for ${queueId}`);
            EdgeRuntime.waitUntil(
              scheduleProcessing(supabase, queueId)
            );
          } else {
            console.log(`[whatsapp-webhook] Queue UPDATED - timer already running for ${queueId}`);
          }
        }
      } catch (debounceError) {
        console.error('[whatsapp-webhook] Debounce error:', debounceError);
        // Fallback to direct processing if debounce fails
        const { error: aiError } = await supabase.functions.invoke('whatsapp-ai-agent', {
          body: {
            restaurantId: restaurant.id,
            customerPhone: from,
            messageBody: messageBody,
            instanceName: instanceName,
          },
        });
        
        if (aiError) {
          console.error('[whatsapp-webhook] Fallback AI agent error:', aiError);
        }
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

// Debounce queue management functions
// FASE 1: Increased from 5 to 8 seconds for better message grouping
const DEBOUNCE_SECONDS = 8;

async function addToDebounceQueue(
  supabase: any,
  restaurantId: string,
  customerPhone: string,
  messageBody: string,
  instanceName: string
): Promise<{ id: string; action: string; message_count: number } | null> {
  console.log(`[addToDebounceQueue] Attempting to add/update queue for ${customerPhone}`);

  // ATOMIC UPSERT: Try to insert, if unique constraint violated, update instead
  // This prevents race conditions when multiple messages arrive simultaneously
  const { data: result, error } = await supabase.rpc('upsert_debounce_message', {
    p_restaurant_id: restaurantId,
    p_customer_phone: customerPhone,
    p_message_body: messageBody,
    p_instance_name: instanceName,
    p_debounce_seconds: DEBOUNCE_SECONDS
  });

  if (error) {
    console.error('[addToDebounceQueue] Error upserting queue:', error);
    throw error;
  }

  const queueId = result[0]?.id;
  const action = result[0]?.action; // 'created' or 'updated'
  const messageCount = result[0]?.message_count;

  console.log(`[addToDebounceQueue] ${action} queue entry ${queueId} (${messageCount} messages)`);

  return { id: queueId, action, message_count: messageCount };
}

async function scheduleProcessing(supabase: any, queueId: string) {
  const MAX_RETRIES = 20; // Máximo ~160 segundos de espera total (20 * 8s)
  
  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    // Esperar DEBOUNCE_SECONDS antes de verificar
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_SECONDS * 1000));
    
    console.log(`[scheduleProcessing] Attempt ${retry + 1}/${MAX_RETRIES} for queue entry: ${queueId}`);
    
    try {
      // Verificar status atual da queue
      const { data: queueEntry, error: fetchError } = await supabase
        .from('message_debounce_queue')
        .select('status, last_message_at, messages')
        .eq('id', queueId)
        .single();
      
      if (fetchError || !queueEntry) {
        console.log(`[scheduleProcessing] Queue entry not found or error: ${fetchError?.message}`);
        return;
      }
      
      // Se já foi processado, sair
      if (queueEntry.status !== 'pending') {
        console.log(`[scheduleProcessing] Queue already ${queueEntry.status}, exiting`);
        return;
      }
      
      // Verificar se passaram DEBOUNCE_SECONDS desde última mensagem
      const lastMessageTime = new Date(queueEntry.last_message_at).getTime();
      const now = Date.now();
      const timeSinceLastMessage = (now - lastMessageTime) / 1000;
      
      console.log(`[scheduleProcessing] Time since last message: ${timeSinceLastMessage.toFixed(1)}s (need ${DEBOUNCE_SECONDS}s)`);
      
      if (timeSinceLastMessage >= DEBOUNCE_SECONDS) {
        // Hora de processar! Todas as mensagens foram coletadas
        const messageCount = Array.isArray(queueEntry.messages) ? queueEntry.messages.length : 0;
        console.log(`[scheduleProcessing] ✅ Processing queue entry: ${queueId} with ${messageCount} messages`);
        
        const { data, error } = await supabase.functions.invoke('process-debounced-messages', {
          body: { queueId },
        });

        if (error) {
          console.error('[scheduleProcessing] Error invoking processor:', error);
          return;
        }
        
        // Se o processador disse "waiting" (nova msg chegou entre checks), continuar o loop
        if (data?.status === 'waiting') {
          console.log(`[scheduleProcessing] ⏳ Processor said waiting (${data.remainingSeconds?.toFixed(1)}s), continuing loop...`);
          continue;
        }
        
        console.log('[scheduleProcessing] Processor response:', data);
        return;
      } else {
        // Nova mensagem chegou dentro do período de debounce, esperar mais
        console.log(`[scheduleProcessing] ⏳ New message arrived, waiting again... (${timeSinceLastMessage.toFixed(1)}s < ${DEBOUNCE_SECONDS}s)`);
        // Continua o loop para esperar mais
      }
    } catch (error) {
      console.error('[scheduleProcessing] Exception:', error);
      return;
    }
  }
  
  console.error(`[scheduleProcessing] ❌ Max retries (${MAX_RETRIES}) reached for queue ${queueId}, forcing processing`);
  
  // Fallback: processar mesmo assim após max retries para não perder mensagens
  try {
    const { data, error } = await supabase.functions.invoke('process-debounced-messages', {
      body: { queueId },
    });
    if (error) {
      console.error('[scheduleProcessing] Fallback processor error:', error);
    }
  } catch (error) {
    console.error('[scheduleProcessing] Fallback exception:', error);
  }
}

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
