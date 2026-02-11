

# Plano: Reestruturação do Prompt V19 + Otimização de Tokens

## Diagnóstico do Problema Atual

Os logs mostram custos absurdos:

| Intent | Tokens | Tempo | Problema |
|--------|--------|-------|----------|
| confirm_item | 44.272 | 17s | 5 iteracoes de tool calling, IA nao sabe usar addon_ids |
| confirm_item | 43.643 | 18s | Mesmo loop - busca Coca-Cola e Pizza dos favoritos |
| confirm_item | 26.269 | 17s | Loop parcial |
| browse_product | 13.398 | 16s | Aceitavel mas lento |
| ask_question | 5.527 | 9s | OK |

**Causa raiz:** O system prompt (~7KB) e TODAS as tool definitions sao enviados em CADA iteracao do loop. Com 5 iteracoes, o prompt fixo e multiplicado 5x.

**Estrutura atual do custo por mensagem:**
- Chamada 1: Orchestrator (prompt 6KB + contexto) = ~2K tokens
- Chamada 2-6: Conversational AI x5 iteracoes (prompt 7KB + tools + contexto + tool results acumulados)
- Total: prompt fixo repetido 5-6 vezes = desperdicio massivo

## Solucao: 3 Frentes Complementares

---

### Frente 1: Prompt V19 com Modo Recepcao e Addon Flow

Reescrever o prompt na tabela `agent_prompt_blocks` para incluir funcionalidades que faltam no V18:

**Secoes novas a adicionar:**

1. **MODO RECEPCAO** (condicional via `{{reception_mode_section}}`)
   - Quando `ai_ordering_enabled = false`: instrui IA a usar APENAS search_menu, send_menu_link, get_customer_history
   - Proibe anotar pedidos, indica link do menu
   - Template: se vazio, nao aparece no prompt (zero tokens extra quando nao usado)

2. **FLUXO DE ADDONS** (nova secao entre Ferramentas e Comportamento)
   - Instrucao explicita: "Quando produto tem addons, usar get_product_addons PRIMEIRO"
   - "Extrair addon_ids do resultado e passar para add_to_cart"
   - "NUNCA buscar addons como produtos separados no search_menu"
   - Exemplo concreto: cliente diz "pode" apos ver 4 addons -> add_to_cart(product_id, addon_ids=[id1,id2,id3,id4])

3. **REGRAS DE COMBO/MENU**
   - Se produto contem "combo" ou "menu" no nome -> perguntar bebida antes de add_to_cart
   - Usar get_product_addons ou search_menu(category:"Bebidas") para mostrar opcoes

4. **REGRAS DE CATEGORIA COMPLETA**
   - Quando cliente pede categoria inteira ("tem bebidas?") -> listar TODOS os produtos
   - Ja implementado no codigo (max_results=100), mas o prompt precisa instruir

---

### Frente 2: Reducao de Tokens na Arquitetura (impacto maior)

**2A. Orchestrator mais leve**

Problema: Orchestrator recebe prompt de 6KB com toda a conversa, mas so precisa classificar intent.

Solucao:
- Reduzir prompt do Orchestrator para ~2KB (remover exemplos extensos, deixar so tabela de intents)
- Enviar apenas ultimas 3 mensagens (nao 5+5) no contexto do Orchestrator
- Remover regex patterns do prompt (ja estao no codigo index.ts)

**2B. Conversational AI - evitar reenvio do prompt fixo**

Problema: Em cada iteracao do loop, o OpenAI recebe novamente o system prompt inteiro. Com 5 iteracoes = 5x o prompt.

Solucao arquitetural: **System prompt cache do OpenAI** ja e usado implicitamente (prompt fixo no system, dinamico no user). Mas podemos reduzir o tamanho do prompt fixo:

- Remover secao FERRAMENTAS do prompt DB (ja vai nas tool definitions do OpenAI - duplicacao pura)
- Remover exemplos extensos de fluxo multi-item (simplificar para 2 linhas)
- Remover secao AUTO-ESCALACAO do prompt (logica ja esta no codigo index.ts)
- Resultado esperado: prompt de 7KB -> ~3.5KB

**2C. Limitar iteracoes por intent**

Problema: confirm_item faz 5 iteracoes (MAX_ITERATIONS) sem necessidade.

Solucao:
- Definir `MAX_ITERATIONS_BY_INTENT`: greeting=1, acknowledgment=1, confirm_item=2, browse_product=2, finalize=3
- Default: 3 (reduzido de 5)
- Isto limita diretamente o custo multiplicativo

**2D. Nao reenviar get_customer_history em confirm_item**

Problema: Nos logs, a IA chama get_customer_history durante confirm_item (para buscar favoritos), depois busca esses favoritos no menu, gerando 3+ iteracoes inuteis.

Solucao:
- Adicionar regra no prompt: "get_customer_history so deve ser usado em greeting ou browse_menu, NUNCA em confirm_item ou provide_address"
- No codigo: filtrar get_customer_history das tools disponiveis quando intent != greeting/browse_menu

---

### Frente 3: Fallback Inteligente

Problema: Quando IA retorna vazio apos tool calls, o fallback despeja dados brutos (29 addons com precos).

Solucao:
- Excluir get_customer_history e get_product_addons do fallback
- Limitar search_menu no fallback a 3 produtos
- Se intent == confirm_item e nao houve add_to_cart: "Desculpa, podes repetir quais complementos queres?"
- Se modo recepcao ativo e resposta vazia: "Faz o teu pedido pelo nosso menu: {menuUrl}"

---

## Detalhes Tecnicos

### Ficheiros a Alterar

1. **`supabase/functions/whatsapp-ai-agent/index.ts`**
   - Adicionar `MAX_ITERATIONS_BY_INTENT` (linhas ~759)
   - Injetar `reception_mode_section` no `applyTemplateVariables` (linhas ~640-675)
   - Filtrar get_customer_history por intent (linhas ~556-588)
   - Melhorar fallback (linhas ~1058-1146)

2. **Nova migration SQL**
   - UPDATE do prompt conversational_ai na tabela `agent_prompt_blocks`
   - Prompt V19: remover secao FERRAMENTAS (duplicada), adicionar MODO RECEPCAO, ADDON FLOW, COMBO RULES
   - UPDATE do prompt orchestrator: versao mais compacta (~2KB)

3. **`supabase/functions/whatsapp-ai-agent/conversational-ai-prompt.ts`**
   - Atualizar fallback TypeScript para V19 (sincronizar com DB)
   - Garantir que `reception_mode_section` e gerado no fallback

### Estimativa de Reducao de Tokens

| Medida | Reducao estimada |
|--------|-----------------|
| Remover secao FERRAMENTAS do prompt (duplicada com tool defs) | -1.5KB (~400 tokens) x iteracoes |
| Remover AUTO-ESCALACAO e exemplos extensos | -1KB (~250 tokens) x iteracoes |
| MAX_ITERATIONS por intent (5 -> 2 para confirm_item) | -60% tokens em confirm_item |
| Filtrar get_customer_history por intent | -1 iteracao em confirm_item |
| Orchestrator mais compacto | -30% tokens por mensagem |

**Impacto total estimado:**
- confirm_item: 44K -> ~10-12K tokens (reducao de 73%)
- browse_product: 13K -> ~6-8K tokens (reducao de 46%)
- greeting/acknowledgment: 5.5K -> ~2-3K tokens (reducao de 55%)

### Novo Prompt V19 (Estrutura)

```text
VENDEDOR INTELIGENTE - {{restaurant_name}}
Info: {{restaurant_info}}

{{reception_mode_section}}

CONTEXTO: Injetado na mensagem do usuario (estado, intent, carrinho, etc.)

MENU (RAG): {{menu_categories}}
Regra: SEMPRE search_menu() antes de falar de produtos.

ADDON FLOW (NOVO):
- Produto com addons -> get_product_addons() PRIMEIRO
- Extrair addon_ids do resultado -> add_to_cart(product_id, addon_ids=[...])
- NUNCA buscar addons como produtos separados
- NUNCA usar get_customer_history durante confirm_item

COMBO RULES (NOVO):
- Produto combo/menu -> perguntar bebida ANTES de add_to_cart
- Se tem addons de bebida, usar get_product_addons
- Se nao, usar search_menu(category:"Bebidas")

CATEGORIA COMPLETA (NOVO):
- "tem bebidas?" -> search_menu(category:"Bebidas") e listar TODOS

COMPORTAMENTO POR INTENT: (igual V18, sem mudancas)
COMUNICACAO: (igual V18)
REGRAS DE NEGOCIO: (igual V18)
SEGURANCA: (igual V18, sem checklist duplicado)
```

Note: Secao FERRAMENTAS removida (ja nas tool definitions da API).
Note: Secao AUTO-ESCALACAO removida (ja no codigo).
Note: Secao FLUXO MULTI-ITEM simplificada para 2 linhas.

