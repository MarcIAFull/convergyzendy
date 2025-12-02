# Guia de Debugging - Zendy AI

Este guia explica como debugar problemas comuns no sistema.

---

## 📋 Índice

1. [Ferramentas de Debug](#ferramentas-de-debug)
2. [Logs do Sistema](#logs-do-sistema)
3. [Problemas Comuns](#problemas-comuns)
4. [Debug do AI Agent](#debug-do-ai-agent)
5. [Debug do WhatsApp](#debug-do-whatsapp)
6. [Debug de Delivery](#debug-de-delivery)
7. [SQL Queries Úteis](#sql-queries-úteis)

---

## Ferramentas de Debug

### 1. Supabase Dashboard

**Edge Function Logs**:
```
Supabase Dashboard → Edge Functions → [função] → Logs
```

Funções mais importantes para debug:
- `whatsapp-webhook` - Recebimento de mensagens
- `whatsapp-ai-agent` - Processamento AI
- `whatsapp-send` - Envio de mensagens
- `process-debounced-messages` - Fila de debounce

**Database Logs**:
```
Supabase Dashboard → Database → Logs
```

### 2. Tabela ai_interaction_logs

A tabela mais importante para debug de AI:

```sql
SELECT 
  created_at,
  customer_phone,
  user_message,
  orchestrator_intent,
  orchestrator_confidence,
  state_before,
  state_after,
  tool_calls_requested,
  tool_execution_results,
  final_response,
  errors,
  processing_time_ms
FROM ai_interaction_logs
WHERE restaurant_id = 'your-restaurant-id'
ORDER BY created_at DESC
LIMIT 20;
```

### 3. Console do Browser

Para debug frontend:
```javascript
// Ver estado das stores
window.__ZUSTAND_DEVTOOLS__ // Se devtools habilitado

// Logs de real-time
// Adicionar em código: console.log('[Component]', data)
```

### 4. TestWhatsApp Page

Página `/test-whatsapp` permite testar o AI sem WhatsApp real:
- Simula envio de mensagens
- Salva mensagens no banco como `inbound`
- Mostra resposta do AI
- Útil para testar prompts e tools

---

## Logs do Sistema

### Formato de Logs das Edge Functions

```
[Módulo] Mensagem de log
[Módulo] ✅ Sucesso
[Módulo] ❌ Erro: descrição

Exemplos:
[EvolutionWebhook] Incoming message from +5532...
[Orchestrator] Intent: browse_menu, confidence: 0.95
[Main AI] Tool called: search_menu
[WhatsApp] ✅ Message sent successfully
```

### Logs Importantes por Função

#### whatsapp-webhook
```
[EvolutionWebhook] Incoming request
[EvolutionWebhook] Raw body: {...}
[EvolutionWebhook] Parsed body: {...}
[whatsapp-webhook] Event type: messages.upsert
[whatsapp-webhook] Routing to restaurant: uuid
[scheduleProcessing] Message queued for debounce
```

#### whatsapp-ai-agent
```
[Context] Building conversation context...
[Orchestrator] Intent Classification: {...}
[Orchestrator] → Intent: browse_menu
[Orchestrator] → Target State: browsing_menu
[Orchestrator] → Confidence: 0.95

[Main AI] ========== ITERATIVE FUNCTION CALLING ==========
[Main AI] Context being passed: ...
[Main AI] Prompt length: X characters

[Iteration 1] ========== CALLING AI ==========
[Iteration 1] Has tool_calls: true
[Tool Execution] Executing: search_menu
[Tool Execution] Result: {...}

[Iteration 2] ========== CALLING AI ==========
[Iteration 2] Has content: true
[Iteration 2] ✅ AI finished with final response

[Response] Final message: "..."
[WhatsApp] ✅ Message sent successfully
[Logging] ✅ Interaction log saved
```

---

## Problemas Comuns

### 1. AI Não Responde

**Sintomas**: Mensagem enviada, nenhuma resposta

**Verificar**:
1. Logs do `whatsapp-webhook` - mensagem chegou?
2. Logs do `process-debounced-messages` - processou?
3. Logs do `whatsapp-ai-agent` - erro?
4. `OPENAI_API_KEY` válida?
5. Restaurante `is_open = true`?

**Query de diagnóstico**:
```sql
-- Verificar mensagens recentes
SELECT * FROM messages 
WHERE restaurant_id = 'uuid' 
ORDER BY timestamp DESC LIMIT 10;

-- Verificar logs de AI
SELECT * FROM ai_interaction_logs
WHERE restaurant_id = 'uuid'
ORDER BY created_at DESC LIMIT 5;

-- Verificar estado da conversa
SELECT * FROM conversation_state
WHERE restaurant_id = 'uuid' 
AND user_phone = '+55...';
```

### 2. AI Diz "Não Encontrei" Quando Produto Existe

**Sintomas**: `search_menu` retorna produtos mas AI diz que não encontrou

**Causa provável**: Bug no iterative loop - AI não está vendo resultados da tool

**Verificar nos logs**:
```
[Tool Execution] Executing: search_menu
[Tool Execution] Result: {"success": true, "products": [...]}
```

Se resultado existe mas AI ignora:
- Verificar se `role: 'tool'` está sendo adicionado ao messages array
- Verificar se loop está continuando após tool execution

**Query**:
```sql
SELECT 
  tool_calls_requested,
  tool_execution_results,
  final_response
FROM ai_interaction_logs
WHERE user_message ILIKE '%coca%'
ORDER BY created_at DESC LIMIT 1;
```

### 3. Mensagens do WhatsApp Não Chegam

**Sintomas**: Envio via WhatsApp mas nada no sistema

**Verificar**:
1. Evolution API rodando?
2. Webhook URL correto no Evolution?
3. Instância conectada?
4. Rate limit atingido?

**Logs do Evolution** (se auto-hospedado):
```bash
docker logs evolution-api
```

**Query**:
```sql
-- Verificar instância
SELECT * FROM whatsapp_instances
WHERE restaurant_id = 'uuid';

-- Verificar mensagens recebidas
SELECT * FROM messages
WHERE direction = 'inbound'
ORDER BY timestamp DESC LIMIT 10;
```

### 4. Erro "Instance Not Found"

**Sintomas**: Erro 404 ao enviar mensagem

**Causa**: Instância desconectada ou não existe

**Solução**:
1. Ir para `/whatsapp-connection`
2. Clicar "Reset Instance"
3. Reconectar via QR Code

**Query**:
```sql
UPDATE whatsapp_instances
SET status = 'disconnected'
WHERE restaurant_id = 'uuid';
```

### 5. Loop Infinito de Perguntas

**Sintomas**: AI repete mesma pergunta ("Qual seu endereço?") mesmo após resposta

**Causa**: Anti-loop rules não aplicadas ou estado não atualizado

**Verificar**:
```sql
-- Verificar estado
SELECT state, metadata FROM conversation_state
WHERE user_phone = '+55...' AND restaurant_id = 'uuid';

-- Metadata deve conter delivery_address se já fornecido
```

**Solução**: Verificar prompt inclui anti-loop rules e estado está sendo atualizado corretamente

### 6. Carrinho Não Persiste

**Sintomas**: Itens adicionados mas desaparecem

**Verificar**:
```sql
-- Verificar carrinho
SELECT * FROM carts
WHERE user_phone = '+55...' 
AND restaurant_id = 'uuid'
AND status = 'active';

-- Verificar itens
SELECT ci.*, p.name 
FROM cart_items ci
JOIN products p ON ci.product_id = p.id
WHERE ci.cart_id = 'cart-uuid';

-- Verificar pending items
SELECT * FROM conversation_pending_items
WHERE user_phone = '+55...'
AND restaurant_id = 'uuid'
AND status = 'pending';
```

---

## Debug do AI Agent

### Verificar Prompt Enviado

```sql
SELECT 
  system_prompt,
  prompt_length,
  tokens_used
FROM ai_interaction_logs
WHERE id = 'log-uuid';
```

### Verificar Tool Calls

```sql
SELECT 
  tool_calls_requested,
  tool_calls_validated,
  tool_execution_results
FROM ai_interaction_logs
WHERE id = 'log-uuid';
```

### Testar Orchestrator Isoladamente

No código (`whatsapp-ai-agent/index.ts`), adicionar logs:

```typescript
console.log('[DEBUG] Orchestrator prompt:', orchestratorPrompt);
console.log('[DEBUG] User message for orchestrator:', rawMessage);
console.log('[DEBUG] Orchestrator response:', orchestratorResult);
```

### Testar Tool Específica

Chamar edge function diretamente via Supabase Dashboard → SQL Editor:

```sql
-- Simular search_menu
SELECT * FROM products
WHERE restaurant_id = 'uuid'
AND (name ILIKE '%pizza%' OR description ILIKE '%pizza%')
AND is_available = true;
```

---

## Debug do WhatsApp

### Verificar Status da Instância

```sql
SELECT 
  instance_name,
  status,
  phone_number,
  updated_at
FROM whatsapp_instances
WHERE restaurant_id = 'uuid';
```

### Verificar Webhook

1. No Evolution API, verificar webhook configurado
2. Deve apontar para: `https://tgbfqcbqfdzrtbtlycve.supabase.co/functions/v1/whatsapp-webhook`

### Testar Envio Manual

Via Supabase Dashboard → Edge Functions → whatsapp-send → Test:

```json
{
  "restaurantId": "uuid",
  "to": "5532999999999",
  "message": "Teste de envio"
}
```

---

## Debug de Delivery

### Verificar Zonas

```sql
SELECT 
  name,
  coordinates,
  fee_amount,
  min_order_amount,
  is_active,
  priority
FROM delivery_zones
WHERE restaurant_id = 'uuid'
ORDER BY priority ASC;
```

### Verificar Cache de Endereço

```sql
SELECT * FROM address_cache
WHERE address_query ILIKE '%rua das flores%'
ORDER BY created_at DESC;
```

### Testar Validação de Endereço

Via edge function `validate-delivery-address`:

```json
{
  "restaurantId": "uuid",
  "address": "Rua das Flores 123, Centro"
}
```

---

## SQL Queries Úteis

### Dashboard de Saúde

```sql
-- Mensagens últimas 24h
SELECT COUNT(*) as total,
  COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
  COUNT(*) FILTER (WHERE direction = 'outbound') as outbound
FROM messages
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- Pedidos últimas 24h
SELECT status, COUNT(*) 
FROM orders
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Erros de AI últimas 24h
SELECT COUNT(*) as errors
FROM ai_interaction_logs
WHERE has_errors = true
AND created_at > NOW() - INTERVAL '24 hours';
```

### Análise de Performance AI

```sql
-- Tempo médio de processamento
SELECT 
  AVG(processing_time_ms) as avg_ms,
  MAX(processing_time_ms) as max_ms,
  MIN(processing_time_ms) as min_ms
FROM ai_interaction_logs
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Tokens usados por intent
SELECT 
  orchestrator_intent,
  AVG(tokens_used) as avg_tokens,
  COUNT(*) as count
FROM ai_interaction_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY orchestrator_intent
ORDER BY count DESC;
```

### Conversas Problemáticas

```sql
-- Conversas com muitas iterações
SELECT 
  customer_phone,
  user_message,
  orchestrator_intent,
  processing_time_ms,
  errors
FROM ai_interaction_logs
WHERE processing_time_ms > 10000
ORDER BY created_at DESC
LIMIT 10;

-- Conversas com erros
SELECT 
  customer_phone,
  user_message,
  errors,
  created_at
FROM ai_interaction_logs
WHERE has_errors = true
ORDER BY created_at DESC
LIMIT 20;
```

### Limpar Dados de Teste

```sql
-- Limpar mensagens de teste
DELETE FROM messages
WHERE from_number = '+5532TEST';

-- Limpar logs de teste
DELETE FROM ai_interaction_logs
WHERE customer_phone = '+5532TEST';

-- Reset estado de conversa
DELETE FROM conversation_state
WHERE user_phone = '+5532TEST';

-- Limpar carrinho
DELETE FROM cart_items
WHERE cart_id IN (
  SELECT id FROM carts 
  WHERE user_phone = '+5532TEST'
);
DELETE FROM carts
WHERE user_phone = '+5532TEST';
```

---

## Checklist de Debug

Quando algo não funciona:

- [ ] Verificar logs da edge function relevante
- [ ] Verificar `ai_interaction_logs` para erros
- [ ] Verificar estado da conversa em `conversation_state`
- [ ] Verificar mensagens em `messages` table
- [ ] Verificar instância WhatsApp em `whatsapp_instances`
- [ ] Verificar secrets no Supabase Dashboard
- [ ] Testar endpoint isoladamente
- [ ] Verificar se há rate limiting
- [ ] Verificar se restaurante está `is_open`

---

**Última atualização**: 2025-12-02
