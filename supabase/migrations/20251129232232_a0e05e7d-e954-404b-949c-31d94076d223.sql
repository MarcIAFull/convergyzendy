-- ============================================================
-- FIX BUG #1: Extract prompts from JSON wrapper in agent_prompt_blocks
-- ============================================================

-- Fix Orchestrator prompts (if wrapped in JSON)
UPDATE agent_prompt_blocks 
SET content = (content::jsonb->>'content')
WHERE content LIKE '{%"role"%"content"%}'
  AND content::jsonb->>'content' IS NOT NULL;

-- Alternative: Fix any blocks that start with { and have content key
UPDATE agent_prompt_blocks 
SET content = (content::jsonb->>'content')
WHERE content LIKE '{"role":%'
  AND content::jsonb->>'content' IS NOT NULL
  AND id NOT IN (SELECT id FROM agent_prompt_blocks WHERE content NOT LIKE '{%');

-- Verify the fix
SELECT 
  a.name as agent_name,
  apb.title,
  LEFT(apb.content, 100) as content_preview,
  CASE 
    WHEN apb.content LIKE '{%"role"%' THEN 'STILL JSON WRAPPED'
    ELSE 'OK'
  END as status
FROM agent_prompt_blocks apb
JOIN agents a ON a.id = apb.agent_id
ORDER BY a.name, apb.ordering;