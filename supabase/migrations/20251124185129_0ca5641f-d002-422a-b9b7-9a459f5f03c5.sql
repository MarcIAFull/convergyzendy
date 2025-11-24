-- Remove unused base_system_prompt column from agents table
-- This field was never used by the runtime, only agent_prompt_blocks are used
ALTER TABLE agents DROP COLUMN IF EXISTS base_system_prompt;