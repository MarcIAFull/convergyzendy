import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('[ZoneSoft Webhook] Received:', JSON.stringify(body, null, 2));

    // ZoneSoft can send different types of callbacks
    // Common fields: doc, serie, numero, loja, estado
    const { 
      doc,           // Document type (TK, VD, etc.)
      serie,         // Document series
      numero,        // Document number
      loja,          // Store ID
      estado,        // Status (can be 'anulado', 'emitido', etc.)
      order_id,      // Our internal order ID (if passed in metadata)
      event_type,    // Type of event (order_status, document_issued, etc.)
    } = body;

    // Log the webhook for debugging
    await supabase.from('zonesoft_sync_logs').insert({
      action: 'webhook_received',
      status: 'pending',
      request_body: body,
      zonesoft_document_number: numero,
      zonesoft_document_type: doc,
      zonesoft_document_series: serie,
    });

    // If we have an order_id, update the order directly
    if (order_id) {
      await handleOrderUpdate(supabase, order_id, body);
    } 
    // Otherwise, try to find the order by document number
    else if (numero && doc) {
      await handleDocumentUpdate(supabase, numero, doc, serie, body);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
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

async function handleOrderUpdate(supabase: any, orderId: string, webhookData: any) {
  const { estado, numero, doc, serie } = webhookData;
  
  console.log(`[ZoneSoft Webhook] Updating order ${orderId} with status: ${estado}`);

  // Map ZoneSoft status to our order status
  const statusMap: Record<string, string> = {
    'emitido': 'confirmed',
    'anulado': 'cancelled',
    'pago': 'confirmed',
    'preparando': 'preparing',
    'pronto': 'ready',
    'entregue': 'delivered',
  };

  const updates: any = {};
  
  // Update document info if provided
  if (numero) updates.zonesoft_document_number = numero;
  if (doc) updates.zonesoft_document_type = doc;
  if (serie) updates.zonesoft_document_series = serie;
  if (!updates.zonesoft_synced_at) updates.zonesoft_synced_at = new Date().toISOString();

  // Update order status if we have a mapping
  if (estado && statusMap[estado.toLowerCase()]) {
    updates.status = statusMap[estado.toLowerCase()];
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (error) {
      console.error('[ZoneSoft Webhook] Failed to update order:', error);
      throw error;
    }

    console.log(`[ZoneSoft Webhook] Order ${orderId} updated successfully`);
  }
}

async function handleDocumentUpdate(
  supabase: any, 
  documentNumber: number, 
  documentType: string, 
  documentSeries: string | null,
  webhookData: any
) {
  console.log(`[ZoneSoft Webhook] Looking for order with document: ${documentType} ${documentSeries || ''} #${documentNumber}`);

  // Find order by ZoneSoft document number
  let query = supabase
    .from('orders')
    .select('id')
    .eq('zonesoft_document_number', documentNumber)
    .eq('zonesoft_document_type', documentType);

  if (documentSeries) {
    query = query.eq('zonesoft_document_series', documentSeries);
  }

  const { data: orders, error } = await query.limit(1);

  if (error) {
    console.error('[ZoneSoft Webhook] Error finding order:', error);
    throw error;
  }

  if (orders && orders.length > 0) {
    await handleOrderUpdate(supabase, orders[0].id, webhookData);
  } else {
    console.log('[ZoneSoft Webhook] No matching order found for document');
  }
}
