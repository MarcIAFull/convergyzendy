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

    // Parse request body for restaurant_id (optional for backward compatibility)
    let requestedRestaurantId: string | null = null;
    try {
      const body = await req.json();
      requestedRestaurantId = body?.restaurant_id || null;
      console.log(`[evolution-status] Received body:`, JSON.stringify(body));
      console.log(`[evolution-status] Extracted restaurant_id from body: ${requestedRestaurantId}`);
    } catch {
      console.log(`[evolution-status] No body or invalid JSON - will use fallback`);
    }

    let restaurantId: string | null = requestedRestaurantId;

    // If restaurant_id provided, validate access
    if (restaurantId) {
      console.log(`[evolution-status] Using provided restaurant_id: ${restaurantId}`);
      
      // Check if user has access to this restaurant
      const { data: hasAccess } = await supabase
        .from('restaurant_owners')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!hasAccess) {
        // Also check if user owns the restaurant directly
        const { data: ownsRestaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('id', restaurantId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!ownsRestaurant) {
          throw new Error('Access denied to this restaurant');
        }
      }
    } else {
      // Fallback: get first restaurant (for backward compatibility)
      console.log(`[evolution-status] No restaurant_id provided, using fallback`);
      
      const { data: restaurantOwner } = await supabase
        .from('restaurant_owners')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (restaurantOwner) {
        restaurantId = restaurantOwner.restaurant_id;
      } else {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        
        if (restaurant) {
          restaurantId = restaurant.id;
        }
      }
    }

    if (!restaurantId) {
      throw new Error('No restaurant found for user');
    }
    
    console.log(`[evolution-status] Using restaurant: ${restaurantId}`);
    
    // Get instance name from database
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .single();

    if (instanceError || !instance) {
      console.log(`[evolution-status] No instance found for restaurant ${restaurantId}`);
      return new Response(
        JSON.stringify({
          status: 'disconnected',
          message: 'WhatsApp not configured. Please connect first.',
          needsConnection: true,
          qr: null,
          lastCheckedAt: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[evolution-status] Checking status for instance: ${instance.instance_name}`);

    // Get status from Evolution API
    let status;
    try {
      status = await getInstanceStatus(instance.instance_name);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = error.statusCode || 0;
      
      console.log(`[evolution-status] Caught error:`, {
        message: errorMessage,
        statusCode: statusCode,
        hasStatusCodeProp: 'statusCode' in error
      });
      
      // If instance doesn't exist in Evolution API (404), return disconnected status
      if (statusCode === 404 || errorMessage.includes('404')) {
        console.log(`[evolution-status] Instance ${instance.instance_name} not found (404) - returning disconnected`);
        return new Response(
          JSON.stringify({
            status: 'disconnected',
            instanceName: instance.instance_name,
            message: 'Instance not found in Evolution API. Please reconnect.',
            needsConnection: true,
            qr: null,
            lastCheckedAt: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      // For other errors, throw to be handled by outer catch
      console.log(`[evolution-status] Re-throwing non-404 error`);
      throw error;
    }
    
    // Get QR code if needed
    let qrData = null;
    
    // Determine status based on Evolution API response
    let instanceStatus: 'connected' | 'waiting_qr' | 'disconnected' = 'disconnected';
    
    console.log('[evolution-status] Evolution API state:', status?.instance?.state);
    
    if (status.instance?.state === 'open') {
      instanceStatus = 'connected';
      console.log('[evolution-status] ✅ WhatsApp is CONNECTED (state: open)');
    } else if (status.instance?.state === 'connecting' || status.instance?.state === 'qr') {
      instanceStatus = 'waiting_qr';
      console.log('[evolution-status] ⏳ WhatsApp is WAITING for QR scan');
      try {
        qrData = await getInstanceQrCode(instance.instance_name);
      } catch (e) {
        console.error('[evolution-status] Error getting QR code:', e);
      }
    } else if (status.instance?.state === 'close') {
      instanceStatus = 'disconnected';
      console.log('[evolution-status] ❌ WhatsApp is DISCONNECTED (state: close)');
    } else {
      console.log('[evolution-status] ⚠️ Unknown state:', status?.instance?.state);
    }

    // Update database with current status
    console.log('[evolution-status] Updating database:', {
      oldStatus: instance.status,
      newStatus: instanceStatus,
      hasQrCode: !!qrData?.qrText
    });
    
    await supabase
      .from('whatsapp_instances')
      .update({
        status: instanceStatus,
        qr_code: qrData?.qrText || null,
        qr_code_base64: null,
        phone_number: status.instance?.owner || instance.phone_number,
        last_connected_at: instanceStatus === 'connected' ? new Date().toISOString() : instance.last_connected_at,
        last_checked_at: new Date().toISOString(),
        metadata: { 
          lastEvolutionState: status?.instance?.state,
          hasQrCode: !!qrData?.qrText,
          checkedAt: new Date().toISOString(),
          phoneNumber: status?.instance?.owner || null,
          raw: status
        }
      })
      .eq('id', instance.id);

    return new Response(
      JSON.stringify({
        status: instanceStatus,
        instanceName: instance.instance_name,
        phoneNumber: status.instance?.owner,
        qr: qrData ? {
          qrText: qrData.qrText || null,
        } : null,
        rawStatus: status,
        lastCheckedAt: new Date().toISOString()
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
