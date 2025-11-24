import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { createOrConnectInstance } from "../_shared/evolutionClient.ts";
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

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantOwner.restaurant_id)
      .single();

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    
    // Generate unique instance name for this restaurant
    const instanceName = `restaurant_${restaurant.id.substring(0, 8)}`;
    
    console.log(`[evolution-connect] Creating/connecting instance for restaurant ${restaurant.id}: ${instanceName}`);

    // Create or connect instance via Evolution API
    const result = await createOrConnectInstance(instanceName, restaurant.phone);

    // Update or insert whatsapp_instances record
    const { data: existingInstance } = await supabase
      .from('whatsapp_instances')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .single();

    if (existingInstance) {
      await supabase
        .from('whatsapp_instances')
        .update({
          instance_name: instanceName,
          status: 'waiting_qr',
          last_checked_at: new Date().toISOString(),
          metadata: result
        })
        .eq('restaurant_id', restaurant.id);
    } else {
      await supabase
        .from('whatsapp_instances')
        .insert({
          restaurant_id: restaurant.id,
          instance_name: instanceName,
          status: 'waiting_qr',
          metadata: result
        });
    }

    // Log the action
    await supabase
      .from('system_logs')
      .insert({
        restaurant_id: restaurant.id,
        log_type: 'whatsapp_connect',
        severity: 'info',
        message: `WhatsApp instance ${instanceName} connection initiated`,
        metadata: { instance_name: instanceName }
      });

    return new Response(
      JSON.stringify({
        success: true,
        instanceName,
        message: 'Instance created/connected. Please scan QR code.',
        ...result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[evolution-connect] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
