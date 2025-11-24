import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DebounceQueueEntry {
  id: string;
  restaurant_id: string;
  customer_phone: string;
  messages: Array<{ body: string; timestamp: string }>;
  first_message_at: string;
  last_message_at: string;
  scheduled_process_at: string;
  status: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { queueId } = await req.json();

    if (!queueId) {
      console.error('[process-debounced-messages] Missing queueId');
      return new Response(JSON.stringify({ error: 'Missing queueId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-debounced-messages] Processing queue entry: ${queueId}`);

    // 1. Buscar entrada da fila
    const { data: queueEntry, error: fetchError } = await supabase
      .from('message_debounce_queue')
      .select('*')
      .eq('id', queueId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !queueEntry) {
      console.error('[process-debounced-messages] Queue entry not found or already processed:', fetchError);
      return new Response(JSON.stringify({ error: 'Queue entry not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const entry = queueEntry as DebounceQueueEntry;

    // 2. Verificar se já passaram 5 segundos desde a última mensagem
    const lastMessageTime = new Date(entry.last_message_at).getTime();
    const now = Date.now();
    const timeSinceLastMessage = (now - lastMessageTime) / 1000;

    if (timeSinceLastMessage < 5) {
      const remainingTime = 5 - timeSinceLastMessage;
      console.log(`[process-debounced-messages] Still waiting. ${remainingTime.toFixed(1)}s remaining`);
      return new Response(JSON.stringify({ 
        status: 'waiting',
        remainingSeconds: remainingTime 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Marcar como processando
    const { error: updateError } = await supabase
      .from('message_debounce_queue')
      .update({ status: 'processing' })
      .eq('id', queueId);

    if (updateError) {
      console.error('[process-debounced-messages] Error updating status:', updateError);
      throw updateError;
    }

    // 4. Compilar mensagens
    const compiledMessage = entry.messages
      .map((msg) => msg.body)
      .join('\n');

    console.log(`[process-debounced-messages] Compiled ${entry.messages.length} messages from ${entry.customer_phone}`);
    console.log(`[process-debounced-messages] Compiled text: ${compiledMessage.substring(0, 100)}...`);

    // 5. Buscar dados do restaurante e instância WhatsApp
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('*, whatsapp_instances(*)')
      .eq('id', entry.restaurant_id)
      .single();

    if (restaurantError || !restaurant) {
      throw new Error(`Restaurant not found: ${restaurantError?.message}`);
    }

    const whatsappInstance = restaurant.whatsapp_instances;
    if (!whatsappInstance || whatsappInstance.length === 0) {
      throw new Error('WhatsApp instance not found');
    }

    const instanceName = whatsappInstance[0].instance_name;

    // 6. Chamar o AI Agent com a mensagem compilada
    console.log(`[process-debounced-messages] Invoking whatsapp-ai-agent...`);
    
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('whatsapp-ai-agent', {
      body: {
        restaurantId: entry.restaurant_id,
        customerPhone: entry.customer_phone,
        messageBody: compiledMessage,
        instanceName: instanceName,
      },
    });

    if (aiError) {
      console.error('[process-debounced-messages] AI Agent error:', aiError);
      
      // Marcar como failed
      await supabase
        .from('message_debounce_queue')
        .update({ 
          status: 'failed',
          error_message: aiError.message,
          processed_at: new Date().toISOString()
        })
        .eq('id', queueId);

      throw aiError;
    }

    // 7. Marcar como completed
    const { error: completeError } = await supabase
      .from('message_debounce_queue')
      .update({ 
        status: 'completed',
        processed_at: new Date().toISOString(),
        metadata: { ai_response: aiResponse }
      })
      .eq('id', queueId);

    if (completeError) {
      console.error('[process-debounced-messages] Error completing queue entry:', completeError);
    }

    console.log(`[process-debounced-messages] Successfully processed queue entry ${queueId}`);

    return new Response(JSON.stringify({ 
      success: true,
      queueId,
      messagesCompiled: entry.messages.length,
      aiResponse 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[process-debounced-messages] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});