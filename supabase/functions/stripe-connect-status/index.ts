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

    // Parse request
    const url = new URL(req.url);
    const restaurant_id = url.searchParams.get('restaurant_id');
    
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

    // Get current settings
    const { data: settings, error: settingsError } = await supabase
      .from('restaurant_settings')
      .select('stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled, stripe_connected_at, online_payments_enabled')
      .eq('restaurant_id', restaurant_id)
      .single();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({
        connected: false,
        stripe_account_id: null,
        charges_enabled: false,
        payouts_enabled: false,
        onboarding_complete: false,
        online_payments_enabled: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If has stripe account, fetch latest status from Stripe
    if (settings.stripe_account_id) {
      try {
        const account = await stripe.accounts.retrieve(settings.stripe_account_id);
        
        const chargesEnabled = account.charges_enabled || false;
        const payoutsEnabled = account.payouts_enabled || false;
        const detailsSubmitted = account.details_submitted || false;

        // Update local database with latest status
        if (
          chargesEnabled !== settings.stripe_charges_enabled ||
          payoutsEnabled !== settings.stripe_payouts_enabled ||
          detailsSubmitted !== settings.stripe_onboarding_complete
        ) {
          await supabase
            .from('restaurant_settings')
            .update({
              stripe_charges_enabled: chargesEnabled,
              stripe_payouts_enabled: payoutsEnabled,
              stripe_onboarding_complete: detailsSubmitted,
              stripe_connected_at: detailsSubmitted && !settings.stripe_connected_at ? new Date().toISOString() : settings.stripe_connected_at,
            })
            .eq('restaurant_id', restaurant_id);
        }

        return new Response(JSON.stringify({
          connected: true,
          stripe_account_id: settings.stripe_account_id,
          charges_enabled: chargesEnabled,
          payouts_enabled: payoutsEnabled,
          onboarding_complete: detailsSubmitted,
          online_payments_enabled: settings.online_payments_enabled || false,
          connected_at: settings.stripe_connected_at,
          account_type: account.type,
          business_name: account.business_profile?.name || account.company?.name,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (stripeError) {
        console.error('[stripe-connect-status] Error fetching Stripe account:', stripeError);
        // Return cached data if Stripe API fails
        return new Response(JSON.stringify({
          connected: true,
          stripe_account_id: settings.stripe_account_id,
          charges_enabled: settings.stripe_charges_enabled,
          payouts_enabled: settings.stripe_payouts_enabled,
          onboarding_complete: settings.stripe_onboarding_complete,
          online_payments_enabled: settings.online_payments_enabled,
          connected_at: settings.stripe_connected_at,
          error: 'Could not verify with Stripe',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({
      connected: false,
      stripe_account_id: null,
      charges_enabled: false,
      payouts_enabled: false,
      onboarding_complete: false,
      online_payments_enabled: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[stripe-connect-status] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
