-- Atualizar Orchestrator com novos intents (acknowledgment, delivery_inquiry, cancel_order)
UPDATE agent_prompt_blocks 
SET content = content || '

### 13. acknowledgment
**Sinais:** "obrigado", "obrigada", "valeu", "thanks", "👍", "🙏", "beleza", "certo"
**Target State:** (manter estado atual)
**Confiança:** 0.7
**Ação:** Resposta curta de cortesia sem mudança de fluxo

### 14. delivery_inquiry  
**Sinais:** "quanto tempo", "demora quanto", "quando chega", "previsão", "tempo de entrega"
**Target State:** (manter estado atual)
**Confiança:** 0.8
**Ação:** Informar tempo estimado de entrega (30-60 min padrão)

### 15. cancel_order
**Sinais:** "cancelar", "desistir", "não quero mais", "cancela", "deixa pra lá"
**Target State:** idle
**Confiança:** 0.85
**Ação:** Confirmar cancelamento e limpar carrinho

## REGRAS DE PRIORIDADE ATUALIZADAS
1. prefilled_order > outros (se detectar padrão de pedido do menu público)
2. provide_address > outros (se detectar padrão de endereço via regex)
3. provide_payment > outros (se detectar método de pagamento)
4. cancel_order > outros (se cliente expressa desistência)
5. needs_human > outros (se frustração ou pedido explícito)
6. confirm_item > browse (se for resposta a uma oferta recente)
7. acknowledgment e delivery_inquiry NÃO mudam estado - apenas respondem
8. security_threat sempre identificado independente do contexto',
updated_at = now()
WHERE id = '7fc9af7d-ea81-40f9-9bb5-eeebf37d9b2a';

-- Adicionar bloco de regras de itens no Conversational AI
INSERT INTO agent_prompt_blocks (agent_id, title, content, ordering, is_locked)
VALUES (
  '1b20ff9a-82b1-47cd-aa06-3708ed76d8c3',
  'Regras de Adição de Itens',
  '## REGRAS DE ADIÇÃO DE ITENS (CRÍTICO)

### Quando usar `add_to_cart` DIRETAMENTE:
- Pedido SIMPLES: 1 item, sem customização ou com addons simples
- Cliente confirmou escolha: "quero esse", "pode ser", "adiciona"
- Item específico mencionado: "quero uma pizza margherita"

### Quando usar `add_pending_item`:
- Pedido COMPLEXO: múltiplos itens mencionados de uma vez ("quero pizza e coca")
- Cliente ainda está decidindo: "deixa eu ver...", "talvez..."
- Customização complexa que precisa confirmação

### REGRA DE OURO:
⚠️ ANTES de chamar `finalize_order`, o sistema automaticamente confirma pending_items.
Mas PREFIRA usar `add_to_cart` diretamente para pedidos simples - é mais rápido e natural.

### Exemplos:
- "Quero uma pizza portuguesa" → `add_to_cart` direto
- "Quero uma pizza e duas cocas" → `add_pending_item` para cada, depois `confirm_pending_items`
- "Esse mesmo" (após mostrar opção) → `add_to_cart` direto',
  5,
  false
);