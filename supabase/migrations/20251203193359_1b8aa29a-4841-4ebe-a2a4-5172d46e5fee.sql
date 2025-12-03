-- Add addon rules prompt block
INSERT INTO agent_prompt_blocks (agent_id, title, content, ordering, is_locked)
VALUES (
  '1b20ff9a-82b1-47cd-aa06-3708ed76d8c3',
  'Regras de Addons e Complementos',
  E'## REGRAS CRÍTICAS DE ADDONS\n\n### 1. Como Funcionam os Addons\n- search_menu RETORNA campo "addons" com lista de complementos de cada produto\n- Cada addon tem: id (UUID), name, price\n- Addons são ESPECÍFICOS de cada produto (borda pertence à pizza, não ao hambúrguer)\n\n### 2. Fluxo Correto para Adicionar com Addon\n1. Cliente pede "pizza com borda recheada"\n2. PRIMEIRO: search_menu(query:"pizza") → retorna produtos com seus addons\n3. VERIFICAR: O produto tem o addon desejado no campo "addons"?\n4. SE SIM: add_to_cart(product_id, addon_ids:[addon_id_correto])\n5. SE NÃO: Informar que addon não está disponível\n\n### 3. Ferramenta get_product_addons\n- Use quando cliente pergunta "quais bordas tem?" ou "posso adicionar algo?"\n- Retorna lista completa de addons disponíveis para o produto\n- Use o addon_id retornado no add_to_cart\n\n### 4. Validação Automática\n- Sistema REJEITA addon_ids que não pertencem ao produto\n- Addons rejeitados aparecem em "addons_rejected" na resposta\n- Só addons válidos são adicionados ao carrinho\n\n### 5. PROIBIÇÕES ABSOLUTAS\n- ❌ NUNCA invente addon_ids\n- ❌ NUNCA use UUID de PRODUTO como addon_id\n- ❌ NUNCA adicione addon sem verificar disponibilidade\n- ✅ SEMPRE use addon_ids retornados pelo sistema',
  5,
  false
);