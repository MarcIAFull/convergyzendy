-- Tabela para agregação diária de tokens
CREATE TABLE IF NOT EXISTS public.token_usage_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Métricas de tokens
  total_tokens INTEGER DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  
  -- Métricas de uso
  total_interactions INTEGER DEFAULT 0,
  avg_tokens_per_interaction NUMERIC(10,2),
  
  -- Custos estimados (USD)
  estimated_cost_usd NUMERIC(10,4) DEFAULT 0,
  
  -- Detalhamento por modelo
  tokens_by_model JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(restaurant_id, date)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_token_usage_daily_restaurant_date ON token_usage_daily(restaurant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_daily_date ON token_usage_daily(date DESC);

-- Habilitar RLS
ALTER TABLE token_usage_daily ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their restaurant token usage"
ON token_usage_daily FOR SELECT
USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Service role can manage token usage"
ON token_usage_daily FOR ALL
USING (true)
WITH CHECK (true);

-- Novos campos em subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tokens_limit INTEGER DEFAULT 500000;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tokens_reset_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS token_alerts_sent JSONB DEFAULT '[]';

-- Função para incrementar tokens na subscription
CREATE OR REPLACE FUNCTION increment_subscription_tokens(
  p_restaurant_id UUID,
  p_tokens INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE subscriptions 
  SET 
    tokens_used = COALESCE(tokens_used, 0) + p_tokens,
    updated_at = now()
  WHERE restaurant_id = p_restaurant_id
    AND status IN ('active', 'trialing');
END;
$$;

-- Função para agregar tokens diariamente (pode ser chamada por cron)
CREATE OR REPLACE FUNCTION aggregate_daily_token_usage(p_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO token_usage_daily (
    restaurant_id, date, total_tokens, total_interactions, 
    avg_tokens_per_interaction, estimated_cost_usd
  )
  SELECT 
    restaurant_id,
    DATE(created_at) as date,
    COALESCE(SUM(tokens_used), 0) as total_tokens,
    COUNT(*) as total_interactions,
    COALESCE(AVG(tokens_used), 0) as avg_tokens_per_interaction,
    ROUND((COALESCE(SUM(tokens_used), 0) * 0.8 * 5 / 1000000) + (COALESCE(SUM(tokens_used), 0) * 0.2 * 15 / 1000000), 4) as estimated_cost_usd
  FROM ai_interaction_logs
  WHERE tokens_used IS NOT NULL
    AND DATE(created_at) = p_date
  GROUP BY restaurant_id, DATE(created_at)
  ON CONFLICT (restaurant_id, date) 
  DO UPDATE SET
    total_tokens = EXCLUDED.total_tokens,
    total_interactions = EXCLUDED.total_interactions,
    avg_tokens_per_interaction = EXCLUDED.avg_tokens_per_interaction,
    estimated_cost_usd = EXCLUDED.estimated_cost_usd,
    updated_at = now();
END;
$$;

-- Habilitar realtime
ALTER TABLE token_usage_daily REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE token_usage_daily;