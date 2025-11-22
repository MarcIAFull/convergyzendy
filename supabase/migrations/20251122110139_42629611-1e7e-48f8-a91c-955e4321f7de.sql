-- Fix security linter warnings

-- 1. Enable RLS on conversation_recovery_attempts
ALTER TABLE conversation_recovery_attempts ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS policies for conversation_recovery_attempts
-- Allow service role full access
CREATE POLICY "Service role full access on conversation_recovery_attempts"
  ON conversation_recovery_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Fix search_path for RPC functions
CREATE OR REPLACE FUNCTION detect_abandoned_carts(p_restaurant_id UUID, p_delay_minutes INTEGER DEFAULT 30)
RETURNS TABLE (
  cart_id UUID,
  user_phone TEXT,
  items_count BIGINT,
  cart_value NUMERIC,
  customer_name TEXT,
  minutes_since_activity NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as cart_id,
    c.user_phone,
    COUNT(ci.id) as items_count,
    SUM(p.price * ci.quantity) as cart_value,
    cu.name as customer_name,
    EXTRACT(EPOCH FROM (NOW() - c.updated_at))/60 as minutes_since_activity
  FROM carts c
  JOIN cart_items ci ON c.id = ci.cart_id
  JOIN products p ON ci.product_id = p.id
  LEFT JOIN customers cu ON c.user_phone = cu.phone
  WHERE c.restaurant_id = p_restaurant_id
    AND c.status = 'active'
    AND c.updated_at < NOW() - (p_delay_minutes || ' minutes')::INTERVAL
    AND c.updated_at > NOW() - INTERVAL '24 hours'
    AND c.id NOT IN (SELECT cart_id FROM orders WHERE cart_id IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM conversation_recovery_attempts cra
      WHERE cra.cart_id = c.id
        AND cra.recovery_type = 'cart_abandoned'
        AND cra.status IN ('pending', 'sent')
        AND cra.created_at > NOW() - INTERVAL '24 hours'
    )
  GROUP BY c.id, c.user_phone, cu.name, c.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION detect_paused_conversations(p_restaurant_id UUID, p_delay_minutes INTEGER DEFAULT 15)
RETURNS TABLE (
  conversation_state_id UUID,
  user_phone TEXT,
  last_state TEXT,
  minutes_since_activity NUMERIC,
  customer_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id as conversation_state_id,
    cs.user_phone,
    cs.state as last_state,
    EXTRACT(EPOCH FROM (NOW() - cs.updated_at))/60 as minutes_since_activity,
    cu.name as customer_name
  FROM conversation_state cs
  LEFT JOIN customers cu ON cs.user_phone = cu.phone
  WHERE cs.restaurant_id = p_restaurant_id
    AND cs.state != 'idle'
    AND cs.updated_at < NOW() - (p_delay_minutes || ' minutes')::INTERVAL
    AND cs.updated_at > NOW() - INTERVAL '2 hours'
    AND NOT EXISTS (
      SELECT 1 FROM conversation_recovery_attempts cra
      WHERE cra.user_phone = cs.user_phone
        AND cra.recovery_type = 'conversation_paused'
        AND cra.status IN ('pending', 'sent')
        AND cra.created_at > NOW() - INTERVAL '2 hours'
    );
END;
$$;

CREATE OR REPLACE FUNCTION detect_inactive_customers(p_restaurant_id UUID, p_delay_days INTEGER DEFAULT 30)
RETURNS TABLE (
  user_phone TEXT,
  customer_name TEXT,
  order_count INTEGER,
  days_since_last_order NUMERIC,
  preferred_items JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cin.phone as user_phone,
    cu.name as customer_name,
    COALESCE(cin.order_count, 0)::INTEGER as order_count,
    EXTRACT(EPOCH FROM (NOW() - cin.last_interaction_at))/(60*60*24) as days_since_last_order,
    cin.preferred_items
  FROM customer_insights cin
  LEFT JOIN customers cu ON cin.phone = cu.phone
  WHERE cin.order_count > 0
    AND cin.last_interaction_at < NOW() - (p_delay_days || ' days')::INTERVAL
    AND NOT EXISTS (
      SELECT 1 FROM conversation_recovery_attempts cra
      WHERE cra.user_phone = cin.phone
        AND cra.restaurant_id = p_restaurant_id
        AND cra.recovery_type = 'customer_inactive'
        AND cra.status IN ('pending', 'sent')
        AND cra.created_at > NOW() - INTERVAL '60 days'
    );
END;
$$;