# Arquitetura Técnica - Zendy AI

Este documento descreve a arquitetura técnica detalhada do sistema, incluindo fluxos de dados, componentes, e decisões de design.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Two-Agent Architecture](#two-agent-architecture)
3. [Iterative Function Calling](#iterative-function-calling)
4. [Tools Disponíveis](#tools-disponíveis)
5. [Estados de Conversa](#estados-de-conversa)
6. [RAG Implementation](#rag-implementation)
7. [Message Debouncing](#message-debouncing)
8. [Fluxo de Dados Completo](#fluxo-de-dados-completo)
9. [Database Schema](#database-schema)

---

## Visão Geral

O Zendy AI utiliza uma arquitetura de microserviços baseada em Supabase Edge Functions, com dois agentes de IA trabalhando em conjunto para processar mensagens de clientes.

### Princípios de Design

1. **Tool-First**: Toda ação é executada via tools, não via código hardcoded
2. **State Machine**: Conversa segue estados definidos com transições claras
3. **RAG**: Dados grandes (menu, histórico) são buscados sob demanda, não injetados no prompt
4. **Iterative Loop**: AI pode chamar múltiplas tools em sequência até gerar resposta final
5. **Active Salesperson**: AI puxa próximo passo automaticamente, não espera cliente perguntar

---

## Two-Agent Architecture

### Orchestrator Agent

**Responsabilidade**: Classificar a intenção do usuário e determinar o próximo estado da conversa.

**Input**:
- Mensagem do cliente
- Estado atual da conversa
- Resumo do carrinho
- Histórico recente (últimas 5 mensagens)

**Output** (JSON):
```json
{
  "intent": "browse_menu",
  "target_state": "browsing_menu",
  "confidence": 0.92,
  "reasoning": "Cliente pediu para ver opções de pizza"
}
```

**Intents Válidos**:
| Intent | Descrição |
|--------|-----------|
| `greeting` | Saudação inicial |
| `browse_menu` | Quer ver cardápio/categorias |
| `browse_product` | Pergunta sobre produto específico |
| `add_item` | Quer adicionar ao carrinho |
| `modify_cart` | Quer alterar/remover itens |
| `view_cart` | Quer ver resumo do carrinho |
| `provide_address` | Forneceu endereço de entrega |
| `provide_payment` | Escolheu forma de pagamento |
| `finalize` | Quer finalizar pedido |
| `ask_question` | Pergunta geral (horário, entrega, etc.) |
| `cancel` | Quer cancelar pedido |
| `unclear` | Intenção não identificada |

### Conversational Agent

**Responsabilidade**: Executar ações via tools e gerar resposta em linguagem natural.

**Input**:
- System prompt com contexto completo
- Intent classificado pelo Orchestrator
- Estado atual
- Histórico de conversa (no system prompt)

**Output**:
- Tool calls (0 a N)
- Mensagem para o cliente

**Características**:
- Usa template de prompt com variáveis ({{restaurant_name}}, {{cart_summary}}, etc.)
- Recebe personalização do restaurante (tom, saudação, upsell)
- Implementa guardrails de segurança
- Segue "Golden Rule" para resultados de busca

---

## Iterative Function Calling

O sistema implementa o padrão correto de function calling da OpenAI:

```typescript
// Estrutura do messages array
const messages = [
  { role: 'system', content: systemPrompt },  // Inclui {{conversation_history}}
  { role: 'user', content: rawMessage }
];

while (iterations < MAX_ITERATIONS) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    tools: availableTools
  });

  const choice = response.choices[0];
  
  // Se AI retornou tool_calls, executar e adicionar resultado
  if (choice.finish_reason === 'tool_calls') {
    // Adicionar resposta do assistente (com tool_calls)
    messages.push(choice.message);
    
    // Executar cada tool e adicionar resultado
    for (const toolCall of choice.message.tool_calls) {
      const result = await executeToolCall(toolCall);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
    // Continuar loop para AI ver os resultados
  } else {
    // AI gerou resposta final, sair do loop
    finalResponse = choice.message.content;
    break;
  }
}
```

**Por que isso é importante**:
- Antes, o sistema fazia single-pass: AI propunha tools mas nunca via os resultados
- Isso causava erros como "não encontrei Coca-Cola" quando na verdade search_menu retornou resultados
- Com iterative loop, AI vê os resultados via `role: 'tool'` e pode usar na resposta

---

## Tools Disponíveis

O Conversational Agent tem acesso a 14 tools:

### Menu & Produtos

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `search_menu` | Busca produtos por nome, categoria ou termo | `query: string` |
| `add_to_cart` | Adiciona produto confirmado ao carrinho | `product_id, quantity, addon_ids?, notes?` |
| `add_pending_item` | Adiciona produto pendente (aguardando confirmação) | `product_id, quantity, addon_ids?, notes?` |
| `confirm_pending_items` | Move itens pendentes para o carrinho | - |
| `remove_pending_item` | Remove item pendente | `pending_item_id` |
| `clear_pending_items` | Limpa todos os itens pendentes | - |

### Carrinho

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `show_cart` | Retorna resumo do carrinho | - |
| `remove_from_cart` | Remove item do carrinho | `cart_item_id` |
| `clear_cart` | Limpa todo o carrinho | - |

### Checkout

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `validate_and_set_delivery_address` | Valida endereço e calcula taxa | `address: string` |
| `set_payment_method` | Define forma de pagamento | `method: 'cash' \| 'card' \| 'pix'` |
| `finalize_order` | Cria pedido e envia confirmação | - |

### Cliente

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `update_customer_profile` | Atualiza nome do cliente | `name: string` |
| `get_customer_history` | Busca histórico e preferências | - |

### Regras de Uso

Cada tool tem `usage_rules` definidas no banco de dados (tabela `agent_tools`):

```
search_menu: "Use quando cliente perguntar sobre produtos, categorias, ou usar termos como 'cardápio', 'menu', 'opções'. Sempre liste TODOS os resultados retornados."

add_to_cart: "Use APENAS quando cliente confirmou explicitamente que quer adicionar. product_id DEVE vir de resultado anterior de search_menu."

validate_and_set_delivery_address: "Use imediatamente quando cliente fornecer endereço. Se válido, NÃO pergunte novamente."
```

---

## Estados de Conversa

A conversa segue uma state machine:

```
┌─────────┐
│  idle   │ ◄─── Início / Pedido finalizado
└────┬────┘
     │ greeting / browse_menu
     ▼
┌──────────────┐
│ browsing_menu│ ◄─── Cliente navegando cardápio
└──────┬───────┘
       │ add_item
       ▼
┌────────────────┐
│ collecting_items│ ◄─── Montando carrinho
└──────┬─────────┘
       │ finalize
       ▼
┌────────────────┐
│ confirming_item│ ◄─── Confirmando itens / coletando endereço
└──────┬─────────┘
       │ provide_address (válido)
       ▼
┌───────────────────┐
│ collecting_payment│ ◄─── Coletando forma de pagamento
└──────┬────────────┘
       │ provide_payment
       ▼
┌────────────────┐
│ confirming_order│ ◄─── Confirmação final
└──────┬─────────┘
       │ finalize_order
       ▼
┌──────────────┐
│ order_complete│ ◄─── Pedido criado
└──────────────┘
```

### Metadados do Estado

Além do estado, o sistema mantém metadados em `conversation_state.metadata`:

```json
{
  "delivery_address": "Rua das Flores 123, Centro",
  "delivery_fee": 5.00,
  "payment_method": "cash",
  "last_shown_products": ["uuid1", "uuid2"],
  "customer_name": "João"
}
```

---

## RAG Implementation

### Menu RAG

**Problema**: Injetar todo o menu no prompt consome muitos tokens (56k+ caracteres para menu grande).

**Solução**: 
1. Prompt recebe apenas lista de categorias (~500 chars)
2. AI usa `search_menu` tool para buscar produtos
3. Resultados da tool são visíveis via iterative loop

```
// No prompt:
## MENU MAP (Categorias Disponíveis)
Pizzas Salgadas, Pizzas Doces, Bebidas, Sobremesas

// AI busca via tool:
search_menu({ query: "pizza margherita" })
// Retorna: [{ id: "uuid", name: "Margherita", price: 45.00, ... }]
```

### Customer RAG

**Problema**: Histórico completo de pedidos é grande demais para o prompt.

**Solução**:
1. Prompt recebe apenas status mínimo do cliente
2. AI usa `get_customer_history` para personalização quando necessário

```
// No prompt:
Cliente: João | Pedidos: 5 | Última visita: 2 dias atrás

// AI busca quando quer personalizar:
get_customer_history()
// Retorna: { preferred_items: ["Margherita", "Coca"], avg_ticket: 65.00, ... }
```

---

## Message Debouncing

Clientes frequentemente enviam múltiplas mensagens em sequência rápida. O sistema agrupa:

```
┌────────────┐    ┌───────────────────────┐    ┌─────────────────────┐
│  Webhook   │───▶│ message_debounce_queue │───▶│ process-debounced   │
│            │    │                        │    │     -messages       │
│ Msg 1: "Oi"│    │ Agrega em 5 segundos   │    │                     │
│ Msg 2: "td │    │                        │    │ Envia mensagem      │
│    bem?"   │    │ Status: pending        │    │ compilada para AI   │
└────────────┘    └───────────────────────┘    └─────────────────────┘
```

**Fluxo**:
1. `whatsapp-webhook` recebe mensagem
2. Chama `upsert_debounce_message()` (função SQL)
3. Se nova entrada: cria com `scheduled_process_at = NOW() + 5s`
4. Se entrada existente (pending): atualiza `scheduled_process_at`
5. Cron job ou webhook timer chama `process-debounced-messages`
6. Compila todas as mensagens em uma e envia para `whatsapp-ai-agent`

---

## Fluxo de Dados Completo

### Exemplo: Cliente pede pizza

```
1. CLIENTE → WhatsApp: "quero uma pizza margherita"

2. EVOLUTION API → whatsapp-webhook
   POST /functions/v1/whatsapp-webhook
   Body: { event: "messages.upsert", data: { body: "quero uma pizza margherita", ... } }

3. whatsapp-webhook → message_debounce_queue
   Insere/atualiza fila com scheduled_process_at = NOW() + 5s

4. (após 5s) process-debounced-messages
   Busca entradas pending com scheduled_process_at <= NOW()
   Compila mensagens e chama whatsapp-ai-agent

5. whatsapp-ai-agent
   a) ORCHESTRATOR: Classifica intent = "add_item", target_state = "collecting_items"
   
   b) CONVERSATIONAL AI (Iteration 1):
      - Envia prompt com contexto
      - AI retorna tool_call: search_menu({ query: "pizza margherita" })
      
   c) TOOL EXECUTION:
      - Busca produtos no banco
      - Retorna: [{ id: "uuid-123", name: "Margherita", price: 45.00 }]
      - Adiciona ao messages: { role: "tool", content: "[...]" }
      
   d) CONVERSATIONAL AI (Iteration 2):
      - AI vê resultado da busca
      - Retorna tool_call: add_pending_item({ product_id: "uuid-123", quantity: 1 })
      
   e) TOOL EXECUTION:
      - Insere em conversation_pending_items
      - Retorna: { success: true, item: { name: "Margherita", ... } }
      
   f) CONVERSATIONAL AI (Iteration 3):
      - AI gera resposta final:
        "Adicionei 1x Pizza Margherita (R$ 45,00). Quer mais alguma coisa ou posso fechar?"

6. whatsapp-ai-agent → whatsapp-send
   Envia resposta para Evolution API

7. whatsapp-send → Evolution API → Cliente
   Mensagem aparece no WhatsApp do cliente

8. Paralelamente:
   - Salva mensagem em `messages` table
   - Atualiza `conversation_state`
   - Loga em `ai_interaction_logs`
```

---

## Database Schema

### Tabelas Principais

```sql
-- Restaurantes e Configuração
restaurants           -- Info básica do restaurante
restaurant_settings   -- Configurações do menu público, cores, etc.
restaurant_ai_settings -- Personalização da IA (tom, saudações, etc.)
restaurant_owners     -- Relação usuário-restaurante

-- Menu
categories            -- Categorias do cardápio
products              -- Produtos com preço, descrição, imagem
addons                -- Adicionais de produtos

-- Clientes e Conversas
customers             -- Perfil do cliente (nome, endereço padrão)
customer_insights     -- Métricas calculadas (frequência, ticket médio)
messages              -- Histórico de mensagens WhatsApp
conversation_state    -- Estado atual da conversa
conversation_mode     -- Modo: ai | human (takeover)
conversation_pending_items -- Itens aguardando confirmação

-- Carrinho e Pedidos
carts                 -- Carrinhos ativos
cart_items            -- Itens no carrinho
cart_item_addons      -- Addons nos itens
orders                -- Pedidos finalizados

-- Delivery
delivery_zones        -- Zonas de entrega com taxas
address_cache         -- Cache de geocoding

-- AI
agents                -- Configuração dos agentes (Orchestrator, Conversational)
agent_prompt_blocks   -- Blocos de prompt editáveis
agent_tools           -- Tools habilitadas com usage_rules
ai_interaction_logs   -- Log completo de cada interação

-- WhatsApp
whatsapp_instances    -- Instâncias conectadas
message_debounce_queue -- Fila de debounce

-- Recovery
conversation_recovery_attempts -- Tentativas de recovery enviadas
```

### Relacionamentos Chave

```
restaurants 1──N categories 1──N products 1──N addons
restaurants 1──N customers
restaurants 1──1 restaurant_ai_settings
restaurants 1──N delivery_zones
restaurants 1──1 whatsapp_instances

customers 1──N orders
customers 1──N carts 1──N cart_items 1──N cart_item_addons
customers 1──N messages
customers 1──1 conversation_state 1──N conversation_pending_items

agents 1──N agent_prompt_blocks
agents 1──N agent_tools
```

---

## Arquivos Principais

### Edge Functions

| Arquivo | Função |
|---------|--------|
| `whatsapp-webhook/index.ts` | Recebe webhooks do Evolution API |
| `whatsapp-ai-agent/index.ts` | Orquestração principal, iterative loop |
| `whatsapp-ai-agent/orchestrator-prompt.ts` | Prompt do Orchestrator |
| `whatsapp-ai-agent/conversational-ai-prompt.ts` | Prompt do Conversational Agent |
| `whatsapp-ai-agent/base-tools.ts` | Definição e execução das 14 tools |
| `whatsapp-ai-agent/context-builder.ts` | Monta contexto da conversa |
| `whatsapp-send/index.ts` | Envia mensagens via Evolution API |
| `process-debounced-messages/index.ts` | Processa fila de debounce |
| `conversation-recovery/index.ts` | Sistema de recovery |
| `evolution-connect/index.ts` | Conecta instância WhatsApp |
| `evolution-status/index.ts` | Status da instância |
| `validate-delivery-address/index.ts` | Validação de endereço |

### Frontend (Principais)

| Arquivo | Função |
|---------|--------|
| `src/pages/Dashboard.tsx` | Gestão de pedidos |
| `src/pages/Messages.tsx` | Chat com clientes |
| `src/pages/MenuManagement.tsx` | CRUD do cardápio |
| `src/pages/WhatsAppConnection.tsx` | Setup WhatsApp |
| `src/pages/AIConfiguration.tsx` | Config dos agentes |
| `src/stores/conversationsStore.ts` | Estado das conversas |
| `src/stores/orderStore.ts` | Estado dos pedidos |

---

## Decisões de Design Importantes

### 1. Histórico de Conversa no System Prompt

O histórico é injetado APENAS no system prompt via `{{conversation_history}}`, não duplicado no messages array. Isso reduz tokens e evita contexto duplicado.

### 2. TestWhatsApp Salva Mensagens

O simulador de chat (`/test-whatsapp`) salva mensagens `inbound` no banco ANTES de chamar o AI, garantindo que o histórico esteja completo.

### 3. Anti-Loop Rules

O prompt inclui regras explícitas para evitar loops:
- Se endereço já foi validado, não perguntar novamente
- Se pagamento já foi definido, não perguntar novamente
- Não saudar ("Olá!") se conversa já está ativa

### 4. Golden Rule de Busca

Se `search_menu` retorna produtos, AI DEVE listá-los. Nunca dizer "não encontrei" se há resultados no array.

---

**Última atualização**: 2025-12-02
