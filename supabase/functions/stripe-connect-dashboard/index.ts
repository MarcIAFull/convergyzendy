import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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
    const stripeSecretKey = Deno.env.get('STRIPE_PLATFORM_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_PLATFORM_SECRET_KEY not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { restaurant_id } = await req.json();
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: 'restaurant_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user owns this restaurant
    const { data: ownership } = await supabase
      .from('restaurant_owners')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .eq('user_id', user.id)
      .single();

    if (!ownership) {
      return new Response(JSON.stringify({ error: 'You do not own this restaurant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get stripe account id
    const { data: settings, error: settingsError } = await supabase
      .from('restaurant_settings')
      .select('stripe_account_id')
      .eq('restaurant_id', restaurant_id)
      .single();

    if (settingsError || !settings?.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'Stripe account not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate login link for Stripe Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(settings.stripe_account_id);

    console.log(`[stripe-connect-dashboard] Generated dashboard link for account ${settings.stripe_account_id}`);

    return new Response(JSON.stringify({
      success: true,
      dashboard_url: loginLink.url,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[stripe-connect-dashboard] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
