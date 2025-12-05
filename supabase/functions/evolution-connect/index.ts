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

    // Parse request body for restaurant_id
    let requestedRestaurantId: string | null = null;
    try {
      const body = await req.json();
      requestedRestaurantId = body?.restaurant_id || null;
    } catch {
      // No body or invalid JSON
    }

    let restaurantId: string | null = requestedRestaurantId;

    // If restaurant_id provided, validate access
    if (restaurantId) {
      console.log(`[evolution-connect] Using provided restaurant_id: ${restaurantId}`);
      
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
      // Fallback: get first restaurant
      const { data: restaurantOwner } = await supabase
        .from('restaurant_owners')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (restaurantOwner) {
        restaurantId = restaurantOwner.restaurant_id;
      }
    }

    if (!restaurantId) {
      throw new Error('No restaurant found for user');
    }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single();

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    
    // Generate unique instance name for this restaurant
    const instanceName = `restaurant_${restaurant.id.substring(0, 8)}`;
    
    console.log(`[evolution-connect] Creating/connecting instance for restaurant ${restaurant.id}: ${instanceName}`);

    // Create or connect instance via Evolution API (includes validation)
    // Don't pass webhook URL - let it use the default Supabase webhook
    const result = await createOrConnectInstance(instanceName);

    // Determine status based on result
    const instanceStatus = result.alreadyExists ? 
      (result.existingStatus?.instance?.state === 'open' ? 'connected' : 'waiting_qr') : 
      'waiting_qr';

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
          status: instanceStatus,
          last_checked_at: new Date().toISOString(),
          metadata: result
        })
        .eq('id', existingInstance.id);
    } else {
      await supabase
        .from('whatsapp_instances')
        .insert({
          restaurant_id: restaurant.id,
          instance_name: instanceName,
          status: instanceStatus,
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
        message: `WhatsApp instance ${instanceName} ${result.alreadyExists ? 'reconnected' : 'created'}`,
        metadata: { instance_name: instanceName, already_exists: result.alreadyExists }
      });

    return new Response(
      JSON.stringify({
        success: true,
        instanceName,
        alreadyExists: result.alreadyExists || false,
        message: result.alreadyExists ? 
          'Instance already exists. Reconnecting...' : 
          'Instance created. Please scan QR code.',
        status: instanceStatus,
        qr: result.qrText ? {
          qrText: result.qrText,
        } : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[evolution-connect] Error:', error);
    
    // Extract error type and provide user-friendly messages
    let errorMessage = 'Unknown error occurred';
    let errorCode = 'UNKNOWN';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('INVALID_API_KEY')) {
        errorMessage = 'Evolution API key is invalid. Please contact support to configure credentials.';
        errorCode = 'INVALID_CREDENTIALS';
        statusCode = 500;
      } else if (error.message.includes('API_UNREACHABLE') || error.message.includes('API_CONNECTION_FAILED')) {
        errorMessage = 'Cannot reach Evolution API server. Please try again later.';
        errorCode = 'API_UNREACHABLE';
        statusCode = 503;
      } else if (error.message.includes('Missing authorization') || error.message.includes('Unauthorized')) {
        errorMessage = error.message;
        errorCode = 'UNAUTHORIZED';
        statusCode = 401;
      } else if (error.message.includes('No restaurant found')) {
        errorMessage = 'No restaurant associated with your account';
        errorCode = 'NO_RESTAURANT';
        statusCode = 404;
      } else {
        errorMessage = error.message;
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        errorCode,
        success: false
      }),
      { 
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
