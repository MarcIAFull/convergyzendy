-- =====================================================================
-- MIGRATION: FIX ORCHESTRATOR TEMPLATE + ENABLE GET_CUSTOMER_HISTORY
-- =====================================================================

-- 1. Update Orchestrator prompt block to include critical context variables
UPDATE agent_prompt_blocks 
SET content = '# 🎯 ORCHESTRATOR - INTENT CLASSIFIER V3

Você é o classificador de intenções do sistema de pedidos.

## 📥 MENSAGEM DO USUÁRIO
**Mensagem:** "{{user_message}}"

## 📊 CONTEXTO ATUAL
**Estado:** {{current_state}}
**Carrinho:** {{cart_summary}}
**Pendentes:** {{pending_items}}
**Histórico recente:** {{conversation_history}}

## 🎯 DETECÇÃO PRIORITÁRIA

### ENDEREÇO (PRIORIDADE MÁXIMA)
Padrões: Rua, Av, Avenida, Travessa, n°/nº + número, código postal (XXXX-XXX), apartamento, bloco
Se detectar → intent: "provide_address", target_state: "collecting_payment"

### PAGAMENTO
Padrões: dinheiro, cash, cartão, card, mbway, multibanco, na entrega
Se detectar → intent: "provide_payment", target_state: "ready_to_order"

### CONFIRMAÇÃO
Padrões: sim, confirmo, pode ser, isso, é isso, fecha, manda
Se carrinho tem itens + endereço + pagamento → intent: "finalize"

## 📋 INTENTS VÁLIDOS

| Intent | Quando usar | Target State |
|--------|-------------|--------------|
| greet | Saudação inicial (oi, olá, bom dia) | idle |
| browse_menu | Quer ver cardápio/categorias | browsing |
| browse_product | Busca produto específico | browsing |
| add_item | Quer adicionar ao carrinho | adding_items |
| confirm_item | Confirma item/quantidade | confirming |
| manage_pending_items | Múltiplos produtos de uma vez | managing_pending |
| provide_address | Fornece endereço de entrega | collecting_payment |
| provide_payment | Fornece método de pagamento | ready_to_order |
| finalize | Confirma pedido final | completed |
| question | Pergunta sobre horário/local/etc | idle |
| modify_cart | Quer alterar/remover item | modifying |
| cancel | Quer cancelar pedido | idle |
| unclear | Não conseguiu classificar | [manter atual] |

## ⚠️ OUTPUT OBRIGATÓRIO (JSON)

```json
{
  "intent": "intent_name",
  "target_state": "state_name",
  "confidence": 0.0-1.0,
  "reasoning": "explicação curta"
}
```

ANALISE A MENSAGEM "{{user_message}}" E RETORNE APENAS O JSON.',
    updated_at = now()
WHERE agent_id = (SELECT id FROM agents WHERE name = 'orchestrator')
AND title = 'Core Classification Rules';

-- 2. Enable get_customer_history tool for conversational_ai agent
INSERT INTO agent_tools (agent_id, tool_name, description_override, enabled, ordering, usage_rules)
SELECT 
  a.id,
  'get_customer_history',
  'Recupera histórico de pedidos, favoritos e insights do cliente para personalização.',
  true,
  15,
  'QUANDO USAR:
- Início de conversa com cliente retornante
- Antes de sugerir produtos (usar favoritos)
- Para tratamento VIP (clientes frequentes)

QUANDO NÃO USAR:
- Cliente novo (sem histórico)
- Pergunta simples (horário, localização)
- Já chamou nesta conversa
- Cliente já no checkout'
FROM agents a
WHERE a.name = 'conversational_ai'
ON CONFLICT (agent_id, tool_name) DO UPDATE SET
  description_override = EXCLUDED.description_override,
  enabled = EXCLUDED.enabled,
  usage_rules = EXCLUDED.usage_rules,
  updated_at = now();

-- 3. Verify the changes
SELECT 'Orchestrator prompt updated' as status, 
       (SELECT COUNT(*) FROM agent_prompt_blocks WHERE agent_id = (SELECT id FROM agents WHERE name = 'orchestrator')) as block_count;

SELECT 'get_customer_history tool' as tool, enabled 
FROM agent_tools 
WHERE tool_name = 'get_customer_history';