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
    const { restaurant_id, return_url, refresh_url } = await req.json();
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: 'restaurant_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user owns this restaurant
    const { data: ownership, error: ownerError } = await supabase
      .from('restaurant_owners')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .eq('user_id', user.id)
      .single();

    if (ownerError || !ownership) {
      return new Response(JSON.stringify({ error: 'You do not own this restaurant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get restaurant info
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, phone')
      .eq('id', restaurant_id)
      .single();

    if (restaurantError || !restaurant) {
      return new Response(JSON.stringify({ error: 'Restaurant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already has a Stripe account
    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('stripe_account_id')
      .eq('restaurant_id', restaurant_id)
      .single();

    let stripeAccountId = settings?.stripe_account_id;

    // Create Stripe Connect account if doesn't exist
    if (!stripeAccountId) {
      console.log(`[stripe-connect-onboard] Creating new Stripe account for restaurant ${restaurant_id}`);
      
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'BR', // Brazil - mesma região da plataforma
        email: user.email,
        business_type: 'company',
        company: {
          name: restaurant.name,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          restaurant_id: restaurant_id,
          restaurant_name: restaurant.name,
        },
      });

      stripeAccountId = account.id;

      // Save to restaurant_settings
      const { error: updateError } = await supabase
        .from('restaurant_settings')
        .update({
          stripe_account_id: stripeAccountId,
          stripe_onboarding_complete: false,
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
        })
        .eq('restaurant_id', restaurant_id);

      if (updateError) {
        console.error('[stripe-connect-onboard] Error saving stripe_account_id:', updateError);
      }

      console.log(`[stripe-connect-onboard] Created Stripe account: ${stripeAccountId}`);
    }

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refresh_url || `${req.headers.get('origin')}/settings?tab=payments&refresh=true`,
      return_url: return_url || `${req.headers.get('origin')}/settings?tab=payments&connected=true`,
      type: 'account_onboarding',
    });

    console.log(`[stripe-connect-onboard] Generated onboarding link for account ${stripeAccountId}`);

    return new Response(JSON.stringify({
      success: true,
      onboarding_url: accountLink.url,
      stripe_account_id: stripeAccountId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[stripe-connect-onboard] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
