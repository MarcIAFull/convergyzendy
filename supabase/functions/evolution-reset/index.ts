import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { deleteInstance, createOrConnectInstance } from '../_shared/evolutionClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing or invalid Authorization header',
          errorCode: 'UNAUTHORIZED' 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[evolution-reset] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token',
          errorCode: 'UNAUTHORIZED' 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = user.id;

    // Get restaurant for this user
    const { data: restaurantOwner, error: ownerError } = await supabase
      .from('restaurant_owners')
      .select('restaurant_id')
      .eq('user_id', userId)
      .single();

    if (ownerError || !restaurantOwner) {
      console.error('[evolution-reset] No restaurant found for user:', userId);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Restaurant not found',
          errorCode: 'NO_RESTAURANT' 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const restaurantId = restaurantOwner.restaurant_id;

    // Get current instance details
    const { data: currentInstance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name')
      .eq('restaurant_id', restaurantId)
      .single();

    const instanceName = currentInstance?.instance_name || `restaurant_${restaurantId.substring(0, 8)}`;

    console.log(`[evolution-reset] Resetting instance for restaurant ${restaurantId}: ${instanceName}`);

    // Step 1: Delete instance from Evolution API
    try {
      await deleteInstance(instanceName);
      console.log('[evolution-reset] Instance deleted from Evolution API');
    } catch (error) {
      console.error('[evolution-reset] Error deleting instance:', error);
      // Continue even if deletion fails
    }

    // Step 2: Delete from database
    const { error: dbDeleteError } = await supabase
      .from('whatsapp_instances')
      .delete()
      .eq('restaurant_id', restaurantId);

    if (dbDeleteError) {
      console.error('[evolution-reset] Error deleting from database:', dbDeleteError);
    }

    console.log('[evolution-reset] Instance data cleared from database');

    // Step 3: Create fresh instance
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
    const result = await createOrConnectInstance(instanceName, webhookUrl);

    // Step 4: Save new instance to database
    const instanceStatus = result?.alreadyExists 
      ? (result.existingStatus?.instance?.state === 'open' ? 'connected' : 'waiting_qr')
      : 'waiting_qr';

    const { error: insertError } = await supabase
      .from('whatsapp_instances')
      .insert({
        restaurant_id: restaurantId,
        instance_name: instanceName,
        status: instanceStatus,
        qr_code: result?.qrText || null,
        metadata: { 
          createdViaReset: true,
          alreadyExists: result?.alreadyExists,
          timestamp: new Date().toISOString()
        }
      });

    if (insertError) {
      console.error('[evolution-reset] Error saving new instance:', insertError);
      throw insertError;
    }

    // Step 5: Log the reset event
    await supabase
      .from('system_logs')
      .insert({
        restaurant_id: restaurantId,
        log_type: 'whatsapp_reset',
        severity: 'info',
        message: `WhatsApp instance reset successfully: ${instanceName}`,
        metadata: { instanceName, result }
      });

    console.log('[evolution-reset] Instance reset complete');

    return new Response(
      JSON.stringify({
        success: true,
        instanceName,
        status: instanceStatus,
        qr: result?.qrText ? { qrText: result.qrText } : null,
        message: 'Instance reset successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[evolution-reset] Reset error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'RESET_FAILED'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
