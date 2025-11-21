-- ============================================================
-- FASE A + B: Correções Críticas e Simplificação
-- ============================================================
-- 1. Popular tabela agent_tools com tools essenciais
-- 2. Remover tabela conversation_pending_items (simplificação)
-- ============================================================

-- Popular agent_tools para conversational_ai agent
DO $$
DECLARE
  conv_agent_id UUID;
BEGIN
  -- Get conversational_ai agent ID
  SELECT id INTO conv_agent_id FROM agents WHERE name = 'conversational_ai';
  
  IF conv_agent_id IS NULL THEN
    RAISE EXCEPTION 'conversational_ai agent not found!';
  END IF;
  
  -- Delete existing tools (fresh start)
  DELETE FROM agent_tools WHERE agent_id = conv_agent_id;
  
  -- Insert essential tools
  INSERT INTO agent_tools (agent_id, tool_name, enabled, ordering) VALUES
  (conv_agent_id, 'add_to_cart', true, 1),
  (conv_agent_id, 'remove_from_cart', true, 2),
  (conv_agent_id, 'set_delivery_address', true, 3),
  (conv_agent_id, 'set_payment_method', true, 4),
  (conv_agent_id, 'finalize_order', true, 5),
  (conv_agent_id, 'update_customer_profile', true, 6),
  (conv_agent_id, 'show_cart', true, 7),
  (conv_agent_id, 'clear_cart', true, 8);
  
  RAISE NOTICE 'Agent tools populated: 8 tools configured';
  RAISE NOTICE 'Conversational AI agent ID: %', conv_agent_id;
  
  -- Drop conversation_pending_items table (simplification)
  DROP TABLE IF EXISTS conversation_pending_items CASCADE;
  
  RAISE NOTICE 'Pending items table removed - workflow simplified!';
END $$;