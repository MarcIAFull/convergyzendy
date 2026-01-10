-- =====================================================
-- FASE 4: Habilitar extensões para CRON
-- =====================================================

-- Habilitar pg_cron para agendamento
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar pg_net para chamadas HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;