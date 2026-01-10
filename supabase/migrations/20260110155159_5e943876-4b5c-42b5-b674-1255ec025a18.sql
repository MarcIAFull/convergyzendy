-- =====================================================
-- FASE 3: Sistema de Subscriptions e Tenant Settings
-- =====================================================

-- Função para criar subscription trial para um restaurante
CREATE OR REPLACE FUNCTION public.create_trial_subscription(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_subscription_id uuid;
BEGIN
  -- Verificar se já existe subscription
  SELECT id INTO v_existing_subscription_id
  FROM subscriptions
  WHERE restaurant_id = p_restaurant_id
  LIMIT 1;
  
  IF v_existing_subscription_id IS NULL THEN
    INSERT INTO subscriptions (
      restaurant_id,
      plan_name,
      status,
      stripe_price_id,
      current_period_start,
      current_period_end,
      trial_start,
      trial_end,
      orders_limit,
      orders_used,
      tokens_limit,
      tokens_used,
      users_limit
    ) VALUES (
      p_restaurant_id,
      'starter',
      'trialing',
      'price_starter_trial',
      now(),
      now() + INTERVAL '30 days',
      now(),
      now() + INTERVAL '30 days',
      100,
      0,
      500000,
      0,
      3
    );
  END IF;
END;
$$;

-- Função para criar tenant_settings padrão para um restaurante
CREATE OR REPLACE FUNCTION public.create_default_tenant_settings(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_settings_id uuid;
BEGIN
  -- Verificar se já existe tenant_settings
  SELECT id INTO v_existing_settings_id
  FROM tenant_settings
  WHERE restaurant_id = p_restaurant_id
  LIMIT 1;
  
  IF v_existing_settings_id IS NULL THEN
    INSERT INTO tenant_settings (
      restaurant_id,
      timezone,
      locale,
      currency,
      primary_color
    ) VALUES (
      p_restaurant_id,
      'Europe/Lisbon',
      'pt-PT',
      'EUR',
      '#8B5CF6'
    );
  END IF;
END;
$$;

-- Trigger que executa quando um restaurante é criado
CREATE OR REPLACE FUNCTION public.on_restaurant_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar subscription trial
  PERFORM create_trial_subscription(NEW.id);
  
  -- Criar tenant settings padrão
  PERFORM create_default_tenant_settings(NEW.id);
  
  RETURN NEW;
END;
$$;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS trigger_on_restaurant_created ON restaurants;

-- Criar trigger
CREATE TRIGGER trigger_on_restaurant_created
  AFTER INSERT ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION on_restaurant_created();

-- Popular dados para restaurantes existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM restaurants LOOP
    PERFORM create_trial_subscription(r.id);
    PERFORM create_default_tenant_settings(r.id);
  END LOOP;
END;
$$;

-- Criar entrada inicial de token usage para hoje para restaurantes existentes
INSERT INTO token_usage_daily (restaurant_id, date, total_tokens, total_interactions, avg_tokens_per_interaction, estimated_cost_usd)
SELECT 
  id,
  CURRENT_DATE,
  0,
  0,
  0,
  0
FROM restaurants
ON CONFLICT (restaurant_id, date) DO NOTHING;