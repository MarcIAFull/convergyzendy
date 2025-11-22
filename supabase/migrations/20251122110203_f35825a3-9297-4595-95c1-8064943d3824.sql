-- Enable pg_cron and pg_net extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule conversation recovery to run every 15 minutes
SELECT cron.schedule(
  'conversation-recovery',
  '*/15 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://tgbfqcbqfdzrtbtlycve.supabase.co/functions/v1/conversation-recovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnYmZxY2JxZmR6cnRidGx5Y3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NzU4ODUsImV4cCI6MjA3OTE1MTg4NX0.Z0BN652DB2byne5eOZB5Qj6dFX_Lhxm_Yj-C0MiFTYw'
    ),
    body := jsonb_build_object('timestamp', now())
  ) as request_id;
  $$
);