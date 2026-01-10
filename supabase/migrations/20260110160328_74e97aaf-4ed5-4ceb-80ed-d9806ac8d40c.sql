-- Atualizar função de agregação com preços corretos do GPT-4o mini
CREATE OR REPLACE FUNCTION public.aggregate_daily_token_usage(p_date date DEFAULT (CURRENT_DATE - 1))
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- GPT-4o mini: Input $0.15/1M (80%), Output $0.60/1M (20%)
    ROUND((COALESCE(SUM(tokens_used), 0) * 0.8 * 0.15 / 1000000) + (COALESCE(SUM(tokens_used), 0) * 0.2 * 0.60 / 1000000), 4) as estimated_cost_usd
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
$function$;

-- Recalcular custos históricos com preços corretos
UPDATE token_usage_daily
SET estimated_cost_usd = ROUND((total_tokens * 0.8 * 0.15 / 1000000) + (total_tokens * 0.2 * 0.60 / 1000000), 4),
    updated_at = now();