-- =====================================================
-- CRON Jobs para Recovery e Agregação de Tokens
-- =====================================================

-- Agendar CRON job para conversation-recovery a cada 15 minutos
SELECT cron.schedule(
  'conversation-recovery-job',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tgbfqcbqfdzrtbtlycve.supabase.co/functions/v1/conversation-recovery',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnYmZxY2JxZmR6cnRidGx5Y3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NzU4ODUsImV4cCI6MjA3OTE1MTg4NX0.Z0BN652DB2byne5eOZB5Qj6dFX_Lhxm_Yj-C0MiFTYw"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Agendar CRON job para agregação diária de tokens à 1h da manhã
SELECT cron.schedule(
  'aggregate-token-usage-daily',
  '0 1 * * *',
  $$
  SELECT aggregate_daily_token_usage(CURRENT_DATE - INTERVAL '1 day');
  $$
);

-- Agendar CRON job para limpar caches expirados semanalmente
SELECT cron.schedule(
  'cleanup-expired-caches',
  '0 3 * * 0',
  $$
  SELECT cleanup_expired_caches();
  $$
);