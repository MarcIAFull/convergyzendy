-- ============================================================================
-- Corrigir Security Warnings - Fase 1
-- ============================================================================

-- Corrigir: Function Search Path Mutable
-- Adicionar SET search_path = public às funções

-- 1. Recriar update_updated_at_column com search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- 2. Recriar increment_subscription_usage com search_path
CREATE OR REPLACE FUNCTION public.increment_subscription_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Buscar subscription do restaurante
  SELECT id INTO v_subscription_id
  FROM subscriptions
  WHERE restaurant_id = NEW.restaurant_id
    AND status IN ('active', 'trialing')
  LIMIT 1;

  IF v_subscription_id IS NOT NULL THEN
    -- Incrementar orders_used
    UPDATE subscriptions
    SET orders_used = orders_used + 1
    WHERE id = v_subscription_id;

    -- Registrar no log
    INSERT INTO usage_logs (restaurant_id, subscription_id, event_type, quantity)
    VALUES (NEW.restaurant_id, v_subscription_id, 'order_created', 1);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;