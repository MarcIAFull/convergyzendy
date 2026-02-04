import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GLOVO_STAGING_URL = 'https://ondemand-stageapi.glovoapp.com';
const GLOVO_PRODUCTION_URL = 'https://ondemand-api.glovoapp.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, restaurantId } = await req.json();

    // Verify user has access to restaurant
    const { data: access } = await supabase
      .from('restaurant_owners')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user.id)
      .single();

    if (!access) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Glovo config
    const { data: config, error: configError } = await supabase
      .from('restaurant_glovo_config')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      throw configError;
    }

    if (action === 'get-token') {
      // Check if we have a valid token
      if (config?.access_token && config?.token_expires_at) {
        const expiresAt = new Date(config.token_expires_at);
        const now = new Date();
        // If token expires in more than 5 minutes, it's still valid
        if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
          return new Response(JSON.stringify({ 
            success: true,
            hasValidToken: true 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Need to refresh or get new token
      if (!config?.client_id || !config?.client_secret) {
        return new Response(JSON.stringify({ 
          error: 'Glovo credentials not configured',
          needsConfiguration: true 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const baseUrl = config.environment === 'production' 
        ? GLOVO_PRODUCTION_URL 
        : GLOVO_STAGING_URL;

      // Get new token from Glovo
      const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.client_id,
          client_secret: config.client_secret,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Glovo token error:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Failed to get Glovo token',
          details: errorText 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenData = await tokenResponse.json();
      
      // Calculate expiry (Glovo tokens typically expire in 1 hour)
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));

      // Update config with new token
      await supabase
        .from('restaurant_glovo_config')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          token_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('restaurant_id', restaurantId);

      return new Response(JSON.stringify({ 
        success: true,
        hasValidToken: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'revoke-token') {
      await supabase
        .from('restaurant_glovo_config')
        .update({
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('restaurant_id', restaurantId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Glovo auth error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
