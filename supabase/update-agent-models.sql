-- ============================================================
-- UPDATE AGENT MODELS TO RECOMMENDED DEFAULTS
-- ============================================================
-- 
-- This updates the agents to use optimal models for each role:
-- - Orchestrator: Fast, efficient model for intent classification
-- - Conversational AI: Capable model for natural conversation
-- ============================================================

UPDATE agents 
SET 
  model = 'gpt-4o-mini',
  temperature = 0.2,
  max_tokens = 500,
  top_p = 1.0,
  frequency_penalty = 0.0,
  presence_penalty = 0.0
WHERE name = 'orchestrator';

UPDATE agents 
SET 
  model = 'gpt-4o',
  temperature = 0.7,
  max_tokens = 1000,
  top_p = 1.0,
  frequency_penalty = 0.0,
  presence_penalty = 0.0
WHERE name = 'conversational_ai';

-- Display updated configuration
SELECT 
  name,
  model,
  temperature,
  max_tokens,
  is_active
FROM agents
ORDER BY name;
