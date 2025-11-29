-- Remove the duplicate set_delivery_address entry (it has null usage_rules and is redundant)
DELETE FROM agent_tools 
WHERE tool_name = 'set_delivery_address' 
AND agent_id = (SELECT id FROM agents WHERE type = 'assistant' LIMIT 1);