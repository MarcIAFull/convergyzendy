import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_PLATFORM_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_PLATFORM_WEBHOOK_SECRET');
    
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

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[stripe-payment-webhook] Signature verification failed:', errMessage);
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // For testing without signature verification
      event = JSON.parse(body);
      console.log('[stripe-payment-webhook] WARNING: Running without signature verification');
    }

    console.log(`[stripe-payment-webhook] Received event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[stripe-payment-webhook] Checkout completed: ${session.id}`);
        
        const webOrderId = session.metadata?.web_order_id;
        const couponId = session.metadata?.coupon_id;
        const couponCode = session.metadata?.coupon_code;
        const customerPhone = session.metadata?.customer_phone;
        const restaurantId = session.metadata?.restaurant_id;

        if (!webOrderId) {
          console.error('[stripe-payment-webhook] No web_order_id in metadata');
          break;
        }

        // Update order status
        const { error: updateError } = await supabase
          .from('web_orders')
          .update({
            payment_status: 'paid',
            stripe_payment_intent_id: session.payment_intent as string,
            status: 'confirmed',
          })
          .eq('id', webOrderId);

        if (updateError) {
          console.error('[stripe-payment-webhook] Error updating order:', updateError);
        }

        // Record coupon usage if applicable
        if (couponId && customerPhone) {
          // Get discount amount from order
          const { data: order } = await supabase
            .from('web_orders')
            .select('discount_amount')
            .eq('id', webOrderId)
            .single();

          // Insert usage record
          const { error: usageError } = await supabase
            .from('coupon_usage')
            .insert({
              coupon_id: couponId,
              web_order_id: webOrderId,
              customer_phone: customerPhone,
              discount_applied: order?.discount_amount || 0,
            });

          if (usageError) {
            console.error('[stripe-payment-webhook] Error recording coupon usage:', usageError);
          } else {
            // Increment coupon usage count
            await supabase.rpc('increment_coupon_usage', { coupon_id: couponId });
          }
        }

        // Notify restaurant via WhatsApp (call existing notify function)
        if (restaurantId) {
          try {
            const notifyUrl = `${supabaseUrl}/functions/v1/notify-web-order`;
            await fetch(notifyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                order_id: webOrderId,
                restaurant_id: restaurantId,
              }),
            });
            console.log('[stripe-payment-webhook] Notification sent to restaurant');
          } catch (notifyError) {
            console.error('[stripe-payment-webhook] Error notifying restaurant:', notifyError);
          }
        }

        // Log success
        await supabase.from('system_logs').insert({
          log_type: 'stripe_payment',
          message: `Payment completed for order ${webOrderId}`,
          restaurant_id: restaurantId,
          severity: 'info',
          metadata: {
            session_id: session.id,
            payment_intent: session.payment_intent,
            amount: session.amount_total,
            coupon_code: couponCode,
          },
        });

        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[stripe-payment-webhook] Checkout expired: ${session.id}`);
        
        const webOrderId = session.metadata?.web_order_id;
        if (webOrderId) {
          await supabase
            .from('web_orders')
            .update({ payment_status: 'expired' })
            .eq('id', webOrderId);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`[stripe-payment-webhook] Payment failed: ${paymentIntent.id}`);
        
        const webOrderId = paymentIntent.metadata?.web_order_id;
        if (webOrderId) {
          await supabase
            .from('web_orders')
            .update({ 
              payment_status: 'failed',
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq('id', webOrderId);
        }
        break;
      }

      case 'account.updated': {
        // Handle connected account updates
        const account = event.data.object as Stripe.Account;
        console.log(`[stripe-payment-webhook] Account updated: ${account.id}`);
        
        // Update restaurant settings with latest account status
        await supabase
          .from('restaurant_settings')
          .update({
            stripe_charges_enabled: account.charges_enabled,
            stripe_payouts_enabled: account.payouts_enabled,
            stripe_onboarding_complete: account.details_submitted,
            stripe_connected_at: account.details_submitted ? new Date().toISOString() : null,
          })
          .eq('stripe_account_id', account.id);
        
        break;
      }

      default:
        console.log(`[stripe-payment-webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[stripe-payment-webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
