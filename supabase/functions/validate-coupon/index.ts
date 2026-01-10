import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateCouponRequest {
  restaurant_id: string;
  coupon_code: string;
  customer_phone: string;
  subtotal: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { restaurant_id, coupon_code, customer_phone, subtotal }: ValidateCouponRequest = await req.json();

    if (!restaurant_id || !coupon_code || !customer_phone || subtotal === undefined) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Missing required fields: restaurant_id, coupon_code, customer_phone, subtotal' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedCode = coupon_code.trim().toUpperCase();
    console.log(`[validate-coupon] Validating code "${normalizedCode}" for restaurant ${restaurant_id}, phone ${customer_phone}, subtotal ${subtotal}`);

    // Fetch coupon
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .ilike('code', normalizedCode)
      .single();

    if (couponError || !coupon) {
      console.log(`[validate-coupon] Coupon not found: ${normalizedCode}`);
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Cupom não encontrado' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if coupon is active
    if (!coupon.is_active) {
      console.log(`[validate-coupon] Coupon is not active: ${normalizedCode}`);
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Este cupom não está mais ativo' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check validity period
    const now = new Date();
    const startsAt = new Date(coupon.starts_at);
    const expiresAt = coupon.expires_at ? new Date(coupon.expires_at) : null;

    if (now < startsAt) {
      console.log(`[validate-coupon] Coupon not yet valid: ${normalizedCode}`);
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Este cupom ainda não está válido' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (expiresAt && now > expiresAt) {
      console.log(`[validate-coupon] Coupon expired: ${normalizedCode}`);
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Este cupom expirou' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check global usage limit
    if (coupon.usage_limit !== null && coupon.current_usage >= coupon.usage_limit) {
      console.log(`[validate-coupon] Coupon usage limit reached: ${normalizedCode}`);
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Este cupom atingiu o limite de usos' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check per-phone usage limit
    if (coupon.usage_limit_per_phone !== null) {
      const { count, error: usageError } = await supabase
        .from('coupon_usage')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('customer_phone', customer_phone);

      if (!usageError && count !== null && count >= coupon.usage_limit_per_phone) {
        console.log(`[validate-coupon] Phone already used coupon: ${customer_phone}`);
        return new Response(JSON.stringify({ 
          valid: false, 
          error: 'Você já utilizou este cupom' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check minimum order value
    if (coupon.min_order_value && subtotal < coupon.min_order_value) {
      console.log(`[validate-coupon] Subtotal below minimum: ${subtotal} < ${coupon.min_order_value}`);
      return new Response(JSON.stringify({ 
        valid: false, 
        error: `Pedido mínimo de €${coupon.min_order_value.toFixed(2)} para usar este cupom` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate discount amount
    let discountAmount: number;
    if (coupon.discount_type === 'percentage') {
      discountAmount = subtotal * (coupon.discount_value / 100);
      // Apply max discount cap if set
      if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
        discountAmount = coupon.max_discount_amount;
      }
    } else {
      // Fixed discount
      discountAmount = Math.min(coupon.discount_value, subtotal);
    }

    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;

    console.log(`[validate-coupon] Valid! Discount: €${discountAmount}`);

    return new Response(JSON.stringify({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: discountAmount,
        min_order_value: coupon.min_order_value,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[validate-coupon] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao validar cupom';
    return new Response(JSON.stringify({ 
      valid: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
