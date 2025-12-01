-- Delete old V9 prompt and update V10 to be primary
DELETE FROM public.agent_prompt_blocks 
WHERE id = '1425564d-9da4-49d4-9c02-3368493759fc';

-- Update V10 to have ordering=0
UPDATE public.agent_prompt_blocks 
SET ordering = 0, title = 'System Prompt'
WHERE id = 'a931d6a6-f1a9-4a84-937a-f9c62ade6cb6';