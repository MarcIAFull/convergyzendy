import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreatePaymentSessionRequest {
  web_order_id: string;
  success_url: string;
  cancel_url: string;
}

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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { web_order_id, success_url, cancel_url }: CreatePaymentSessionRequest = await req.json();

    if (!web_order_id || !success_url || !cancel_url) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[create-payment-session] Creating session for order ${web_order_id}`);

    // Fetch order with restaurant info
    const { data: order, error: orderError } = await supabase
      .from('web_orders')
      .select(`
        *,
        restaurants!inner (
          id,
          name
        )
      `)
      .eq('id', web_order_id)
      .single();

    if (orderError || !order) {
      console.error('[create-payment-session] Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get restaurant's Stripe account
    const { data: settings, error: settingsError } = await supabase
      .from('restaurant_settings')
      .select('stripe_account_id, stripe_charges_enabled, online_payments_enabled')
      .eq('restaurant_id', order.restaurant_id)
      .single();

    if (settingsError || !settings?.stripe_account_id) {
      console.error('[create-payment-session] Restaurant not connected to Stripe');
      return new Response(JSON.stringify({ error: 'Restaurant has not connected Stripe' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settings.stripe_charges_enabled) {
      console.error('[create-payment-session] Restaurant Stripe account not fully activated');
      return new Response(JSON.stringify({ error: 'Restaurant Stripe account is not activated' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settings.online_payments_enabled) {
      console.error('[create-payment-session] Online payments disabled for restaurant');
      return new Response(JSON.stringify({ error: 'Online payments are disabled for this restaurant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build line items from order
    const items = order.items as Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      notes?: string;
      addons?: Array<{ name: string; price: number }>;
    }>;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const item of items) {
      // Main product
      let itemTotal = item.unit_price;
      let description = item.notes || '';
      
      // Add addons to price and description
      if (item.addons && item.addons.length > 0) {
        for (const addon of item.addons) {
          itemTotal += addon.price;
        }
        const addonNames = item.addons.map(a => a.name).join(', ');
        description = description ? `${description} | Extras: ${addonNames}` : `Extras: ${addonNames}`;
      }

      lineItems.push({
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(itemTotal * 100), // Convert to cents
          product_data: {
            name: item.product_name,
            description: description || undefined,
          },
        },
        quantity: item.quantity,
      });
    }

    // Add delivery fee if present
    if (order.delivery_fee > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(order.delivery_fee * 100),
          product_data: {
            name: 'Taxa de Entrega',
          },
        },
        quantity: 1,
      });
    }

    // Create discount coupon in Stripe if there's a discount
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    if (order.discount_amount && order.discount_amount > 0) {
      // Create a one-time coupon
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(order.discount_amount * 100),
        currency: 'eur',
        name: order.coupon_code || 'Desconto',
        duration: 'once',
      }, {
        stripeAccount: settings.stripe_account_id,
      });
      
      discounts = [{ coupon: coupon.id }];
    }

    // Create Checkout Session on the connected account
    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      discounts,
      mode: 'payment',
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url,
      customer_email: order.customer_email || undefined,
      metadata: {
        web_order_id: web_order_id,
        restaurant_id: order.restaurant_id,
        customer_phone: order.customer_phone,
        coupon_id: order.coupon_id || '',
        coupon_code: order.coupon_code || '',
      },
      payment_intent_data: {
        metadata: {
          web_order_id: web_order_id,
          restaurant_id: order.restaurant_id,
        },
      },
      locale: 'pt',
    }, {
      stripeAccount: settings.stripe_account_id,
    });

    // Update order with session ID
    await supabase
      .from('web_orders')
      .update({ 
        stripe_session_id: session.id,
        payment_status: 'pending',
      })
      .eq('id', web_order_id);

    console.log(`[create-payment-session] Session created: ${session.id}`);

    return new Response(JSON.stringify({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[create-payment-session] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
