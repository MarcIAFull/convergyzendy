-- Task 1: Add recovery_config column to restaurant_ai_settings
ALTER TABLE public.restaurant_ai_settings
ADD COLUMN recovery_config jsonb DEFAULT '{"enabled": false, "types": {"cart_abandoned": {"enabled": true, "delay_minutes": 30, "max_attempts": 2, "message_template": "Olá {{customer_name}}! 👋 Notei que deixaste {{items_count}} item(ns) no carrinho. Ainda queres finalizar o pedido? Estou aqui para ajudar! 😊"}, "conversation_paused": {"enabled": true, "delay_minutes": 15, "max_attempts": 1, "message_template": "Olá! 👋 Ficou alguma dúvida? Estou aqui para continuar o teu pedido! 😊"}, "customer_inactive": {"enabled": false, "delay_days": 30, "max_attempts": 1, "message_template": "{{customer_name}}! 😊 Sentimos a tua falta! Que tal repetir aquele pedido? Temos novidades no cardápio! 🍕✨"}}}'::jsonb;

-- Task 4: Update detect_abandoned_carts to include web_orders
CREATE OR REPLACE FUNCTION public.detect_abandoned_carts(p_restaurant_id uuid, p_delay_minutes integer DEFAULT 30)
 RETURNS TABLE(cart_id uuid, user_phone text, items_count bigint, cart_value numeric, customer_name text, minutes_since_activity numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  -- WhatsApp carts
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
    AND c.id NOT IN (SELECT o.cart_id FROM orders o WHERE o.cart_id IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM conversation_recovery_attempts cra
      WHERE cra.cart_id = c.id
        AND cra.recovery_type = 'cart_abandoned'
        AND cra.status IN ('pending', 'sent')
        AND cra.created_at > NOW() - INTERVAL '24 hours'
    )
  GROUP BY c.id, c.user_phone, cu.name, c.updated_at

  UNION ALL

  -- Web orders abandoned (pending/unpaid)
  SELECT
    wo.cart_id as cart_id,
    wo.customer_phone as user_phone,
    jsonb_array_length(wo.items)::bigint as items_count,
    wo.total_amount as cart_value,
    wo.customer_name as customer_name,
    EXTRACT(EPOCH FROM (NOW() - wo.updated_at))/60 as minutes_since_activity
  FROM web_orders wo
  WHERE wo.restaurant_id = p_restaurant_id
    AND wo.status = 'pending'
    AND (wo.payment_status IS NULL OR wo.payment_status != 'paid')
    AND wo.updated_at < NOW() - (p_delay_minutes || ' minutes')::INTERVAL
    AND wo.updated_at > NOW() - INTERVAL '24 hours'
    AND wo.customer_phone IS NOT NULL
    AND wo.customer_phone != ''
    AND NOT EXISTS (
      SELECT 1 FROM conversation_recovery_attempts cra
      WHERE cra.user_phone = wo.customer_phone
        AND cra.restaurant_id = p_restaurant_id
        AND cra.recovery_type = 'cart_abandoned'
        AND cra.status IN ('pending', 'sent')
        AND cra.created_at > NOW() - INTERVAL '24 hours'
    );
END;
$function$;

-- Update detect_inactive_customers to also consider web_orders
CREATE OR REPLACE FUNCTION public.detect_inactive_customers(p_restaurant_id uuid, p_delay_days integer DEFAULT 30)
 RETURNS TABLE(user_phone text, customer_name text, order_count integer, days_since_last_order numeric, preferred_items jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH all_customers AS (
    -- From customer_insights (WhatsApp orders)
    SELECT 
      cin.phone as phone,
      cu.name as name,
      COALESCE(cin.order_count, 0) as o_count,
      cin.last_interaction_at,
      cin.preferred_items as pref_items
    FROM customer_insights cin
    LEFT JOIN customers cu ON cin.phone = cu.phone
    WHERE cin.order_count > 0

    UNION

    -- From web_orders
    SELECT
      wo.customer_phone as phone,
      MAX(wo.customer_name) as name,
      COUNT(*)::integer as o_count,
      MAX(wo.created_at) as last_interaction_at,
      '[]'::jsonb as pref_items
    FROM web_orders wo
    WHERE wo.restaurant_id = p_restaurant_id
      AND wo.status NOT IN ('pending', 'cancelled')
      AND wo.customer_phone IS NOT NULL
      AND wo.customer_phone != ''
    GROUP BY wo.customer_phone
  ),
  aggregated AS (
    SELECT
      ac.phone,
      MAX(ac.name) as name,
      SUM(ac.o_count)::integer as total_orders,
      MAX(ac.last_interaction_at) as last_active,
      (array_agg(ac.pref_items ORDER BY ac.o_count DESC))[1] as pref_items
    FROM all_customers ac
    GROUP BY ac.phone
  )
  SELECT 
    a.phone as user_phone,
    a.name as customer_name,
    a.total_orders as order_count,
    EXTRACT(EPOCH FROM (NOW() - a.last_active))/(60*60*24) as days_since_last_order,
    a.pref_items as preferred_items
  FROM aggregated a
  WHERE a.total_orders > 0
    AND a.last_active < NOW() - (p_delay_days || ' days')::INTERVAL
    AND NOT EXISTS (
      SELECT 1 FROM conversation_recovery_attempts cra
      WHERE cra.user_phone = a.phone
        AND cra.restaurant_id = p_restaurant_id
        AND cra.recovery_type = 'customer_inactive'
        AND cra.status IN ('pending', 'sent')
        AND cra.created_at > NOW() - INTERVAL '60 days'
    );
END;
$function$;