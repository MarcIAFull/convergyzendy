import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppMessage } from "../_shared/evolutionClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestMessageRequest {
  phone: string;
  message: string;
  restaurantId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check - require logged-in user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[EvolutionTestMessage] No authorization header');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Authentication required' 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with service role for verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[EvolutionTestMessage] Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid authentication token' 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { phone, message, restaurantId }: TestMessageRequest = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required fields: phone and message' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user has access to at least one restaurant with WhatsApp connected
    let instanceName: string | null = null;

    if (restaurantId) {
      // Check specific restaurant access
      const { data: owner } = await supabase
        .from('restaurant_owners')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
        .single();

      if (!owner) {
        console.error('[EvolutionTestMessage] User does not have access to restaurant:', restaurantId);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'You do not have access to this restaurant' 
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Get WhatsApp instance for this restaurant
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_name')
        .eq('restaurant_id', restaurantId)
        .single();

      instanceName = instance?.instance_name || null;
    } else {
      // Get any restaurant the user owns with WhatsApp connected
      const { data: restaurants } = await supabase
        .from('restaurant_owners')
        .select('restaurant_id')
        .eq('user_id', user.id);

      if (!restaurants || restaurants.length === 0) {
        console.error('[EvolutionTestMessage] User has no restaurants');
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'You must have a restaurant to send test messages' 
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Find a restaurant with WhatsApp connected
      const restaurantIds = restaurants.map(r => r.restaurant_id);
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, restaurant_id')
        .in('restaurant_id', restaurantIds)
        .limit(1)
        .single();

      instanceName = instance?.instance_name || null;
    }

    // Fallback to environment variable if no instance found
    if (!instanceName) {
      instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || null;
    }

    if (!instanceName) {
      console.error('[EvolutionTestMessage] No WhatsApp instance available');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No WhatsApp instance connected. Please connect WhatsApp first.' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[EvolutionTestMessage] User ${user.id} sending test message to ${phone} via instance ${instanceName}`);

    // Send message via Evolution API client
    const result = await sendWhatsAppMessage(instanceName, phone, message);

    console.log('[EvolutionTestMessage] Test message sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Test message sent successfully',
        messageId: result.key?.id || null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[EvolutionTestMessage] Error sending test message:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test message' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
