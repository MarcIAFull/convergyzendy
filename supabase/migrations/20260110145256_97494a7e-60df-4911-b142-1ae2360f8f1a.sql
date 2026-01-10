-- ============================================
-- PHASE 1: Stripe Connect + Coupons Infrastructure
-- ============================================

-- 1. Add Stripe Connect columns to restaurant_settings
ALTER TABLE public.restaurant_settings 
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS online_payments_enabled BOOLEAN DEFAULT false;

-- 2. Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  
  -- Code and description
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Discount type
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  
  -- Limits
  min_order_value NUMERIC DEFAULT 0,
  max_discount_amount NUMERIC,
  
  -- Usage
  usage_limit INTEGER,
  usage_limit_per_phone INTEGER DEFAULT 1,
  current_usage INTEGER DEFAULT 0,
  
  -- Validity period
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(restaurant_id, code)
);

-- 3. Create coupon_usage table
CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  web_order_id UUID NOT NULL REFERENCES public.web_orders(id) ON DELETE CASCADE,
  
  customer_phone TEXT NOT NULL,
  discount_applied NUMERIC NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(coupon_id, customer_phone)
);

-- 4. Add payment and coupon columns to web_orders
ALTER TABLE public.web_orders
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id),
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coupons_restaurant ON public.coupons(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(restaurant_id, code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_coupon_usage_phone ON public.coupon_usage(coupon_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_web_orders_stripe_session ON public.web_orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_settings_stripe ON public.restaurant_settings(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- 6. Enable RLS on new tables
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for coupons
CREATE POLICY "Restaurant owners can manage coupons"
  ON public.coupons FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.restaurant_owners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view active coupons for validation"
  ON public.coupons FOR SELECT
  USING (
    is_active = true 
    AND starts_at <= NOW() 
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (usage_limit IS NULL OR current_usage < usage_limit)
  );

-- 8. RLS Policies for coupon_usage
CREATE POLICY "Restaurant owners can view coupon usage"
  ON public.coupon_usage FOR SELECT
  USING (
    coupon_id IN (
      SELECT c.id FROM public.coupons c
      JOIN public.restaurant_owners ro ON c.restaurant_id = ro.restaurant_id
      WHERE ro.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert coupon usage"
  ON public.coupon_usage FOR INSERT
  WITH CHECK (true);

-- 9. Trigger for updated_at on coupons
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();