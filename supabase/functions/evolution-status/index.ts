import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getInstanceStatus, getInstanceQrCode } from "../_shared/evolutionClient.ts";
import { validateRestaurantAccess } from "../_shared/authMiddleware.ts";

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token and user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's restaurant
    const { data: restaurantOwner } = await supabase
      .from('restaurant_owners')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .single();

    if (!restaurantOwner) {
      throw new Error('No restaurant found for user');
    }
    
    // Get instance name from database
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('restaurant_id', restaurantOwner.restaurant_id)
      .single();

    if (instanceError || !instance) {
      console.log(`[evolution-status] No instance found for restaurant ${restaurantOwner.restaurant_id}`);
      return new Response(
        JSON.stringify({
          status: 'disconnected',
          message: 'WhatsApp not configured. Please connect first.',
          needsConnection: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[evolution-status] Checking status for instance: ${instance.instance_name}`);

    // Get status from Evolution API
    const status = await getInstanceStatus(instance.instance_name);
    
    let qrData = null;
    let mappedStatus = 'disconnected';

    if (status.instance?.state === 'open') {
      if (status.instance?.status === 'connected') {
        mappedStatus = 'connected';
      } else {
        // Status is open but not connected - waiting for QR scan
        mappedStatus = 'disconnected';
        try {
          qrData = await getInstanceQrCode(instance.instance_name);
        } catch (e) {
          console.error('[evolution-status] Error getting QR code:', e);
        }
      }
    } else if (status.instance?.state === 'connecting' || status.instance?.state === 'qr') {
      mappedStatus = 'waiting_qr';
      try {
        qrData = await getInstanceQrCode(instance.instance_name);
      } catch (e) {
        console.error('[evolution-status] Error getting QR code:', e);
      }
    }

    // Update database with current status
    await supabase
      .from('whatsapp_instances')
      .update({
        status: mappedStatus,
        qr_code: qrData?.code || null,
        qr_code_base64: qrData?.base64 || null,
        phone_number: status.instance?.owner || instance.phone_number,
        last_connected_at: mappedStatus === 'connected' ? new Date().toISOString() : instance.last_connected_at,
        last_checked_at: new Date().toISOString(),
        metadata: status
      })
      .eq('id', instance.id);

    return new Response(
      JSON.stringify({
        status: mappedStatus,
        instanceName: instance.instance_name,
        phoneNumber: status.instance?.owner,
        qrCode: qrData,
        rawStatus: status,
        lastChecked: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[evolution-status] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'unknown'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
