-- Function to increment coupon usage count
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE coupons 
  SET current_usage = current_usage + 1,
      updated_at = NOW()
  WHERE id = coupon_id;
END;
$$;