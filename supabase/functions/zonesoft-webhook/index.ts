import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    const body = await req.json();
    console.log('[ZoneSoft Webhook] Received:', JSON.stringify(body));

    const { doc, serie, numero, estado, order_id } = body;

    // Log webhook
    await supabase.from('zonesoft_sync_logs').insert({
      action: 'webhook_received',
      status: 'pending',
      request_body: body,
      zonesoft_document_number: numero,
      zonesoft_document_type: doc,
      zonesoft_document_series: serie,
    });

    // Status mapping
    const statusMap: Record<string, string> = {
      'emitido': 'confirmed',
      'anulado': 'cancelled',
      'pago': 'confirmed',
      'preparando': 'preparing',
      'pronto': 'ready',
      'entregue': 'delivered',
    };

    // Find order by order_id or document number
    let orderId = order_id;
    if (!orderId && numero && doc) {
      const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('zonesoft_document_number', numero)
        .eq('zonesoft_document_type', doc)
        .limit(1)
        .single();
      orderId = data?.id;
    }

    // Update order if found
    if (orderId) {
      const updates: Record<string, unknown> = {};
      if (numero) updates.zonesoft_document_number = numero;
      if (doc) updates.zonesoft_document_type = doc;
      if (serie) updates.zonesoft_document_series = serie;
      if (estado && statusMap[estado.toLowerCase()]) {
        updates.status = statusMap[estado.toLowerCase()];
      }
      updates.zonesoft_synced_at = new Date().toISOString();

      await supabase.from('orders').update(updates).eq('id', orderId);
      console.log(`[ZoneSoft Webhook] Order ${orderId} updated`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ZoneSoft Webhook] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
