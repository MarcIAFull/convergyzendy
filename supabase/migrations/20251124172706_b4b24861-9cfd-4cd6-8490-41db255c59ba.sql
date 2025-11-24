-- Ativar as 5 tools de pending items para o agente conversational_ai
-- Buscar o ID do agente pelo nome 'conversational_ai'

DO $$
DECLARE
  v_agent_id uuid;
  v_max_ordering integer;
BEGIN
  -- Buscar o ID do agente conversational_ai pelo nome
  SELECT id INTO v_agent_id
  FROM agents
  WHERE name = 'conversational_ai' AND is_active = true
  LIMIT 1;

  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Agente conversational_ai não encontrado';
  END IF;

  -- Buscar o maior ordering atual
  SELECT COALESCE(MAX(ordering), 0) INTO v_max_ordering
  FROM agent_tools
  WHERE agent_id = v_agent_id;

  -- Inserir search_menu
  INSERT INTO agent_tools (agent_id, tool_name, enabled, ordering, description_override, usage_rules)
  VALUES (
    v_agent_id,
    'search_menu',
    true,
    v_max_ordering + 1,
    NULL,
    'Use quando o cliente pedir para ver o cardápio, buscar produtos específicos ou perguntar sobre disponibilidade de itens.'
  )
  ON CONFLICT (agent_id, tool_name) DO UPDATE
  SET enabled = true, ordering = v_max_ordering + 1;

  -- Inserir add_pending_item
  INSERT INTO agent_tools (agent_id, tool_name, enabled, ordering, description_override, usage_rules)
  VALUES (
    v_agent_id,
    'add_pending_item',
    true,
    v_max_ordering + 2,
    NULL,
    'Use para adicionar produtos à lista de pending items. SEMPRE use esta tool ao invés de add_to_cart diretamente. Permite ao cliente revisar antes de confirmar.'
  )
  ON CONFLICT (agent_id, tool_name) DO UPDATE
  SET enabled = true, ordering = v_max_ordering + 2;

  -- Inserir remove_pending_item
  INSERT INTO agent_tools (agent_id, tool_name, enabled, ordering, description_override, usage_rules)
  VALUES (
    v_agent_id,
    'remove_pending_item',
    true,
    v_max_ordering + 3,
    NULL,
    'Use para remover ou diminuir quantidade de itens pendentes. Pode remover tudo ou apenas diminuir quantidade.'
  )
  ON CONFLICT (agent_id, tool_name) DO UPDATE
  SET enabled = true, ordering = v_max_ordering + 3;

  -- Inserir confirm_pending_items
  INSERT INTO agent_tools (agent_id, tool_name, enabled, ordering, description_override, usage_rules)
  VALUES (
    v_agent_id,
    'confirm_pending_items',
    true,
    v_max_ordering + 4,
    NULL,
    'Use quando o cliente confirmar que quer adicionar os pending items ao carrinho. Esta tool move os itens de pending para o cart.'
  )
  ON CONFLICT (agent_id, tool_name) DO UPDATE
  SET enabled = true, ordering = v_max_ordering + 4;

  -- Inserir clear_pending_items
  INSERT INTO agent_tools (agent_id, tool_name, enabled, ordering, description_override, usage_rules)
  VALUES (
    v_agent_id,
    'clear_pending_items',
    true,
    v_max_ordering + 5,
    NULL,
    'Use para limpar todos os pending items quando o cliente quiser recomeçar ou desistir da seleção atual.'
  )
  ON CONFLICT (agent_id, tool_name) DO UPDATE
  SET enabled = true, ordering = v_max_ordering + 5;

END $$;