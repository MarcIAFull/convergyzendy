
# Plano de Correções: 4 Pedidos dos Clientes

## Resumo das Correções

| # | Problema | Ficheiro(s) Afetado(s) |
|---|----------|----------------------|
| 1 | Carrinho expira em 24h, deveria ser 12h | context-builder.ts, publicCartStore.ts, migration SQL |
| 2 | search_menu limita resultados a 5 itens | index.ts (search_menu tool), smart-search.ts, base-tools.ts, conversational-ai-prompt.ts |
| 3 | Agente diz "Aberto" mesmo quando fechado | context-builder.ts (formatRestaurantInfoForPrompt) |
| 4 | Combo nao pergunta bebida | conversational-ai-prompt.ts, base-tools.ts |

---

## Correcao 1: Carrinho expira em 12h (nao 24h)

Alterar o TTL de 24h para 12h em todos os pontos:

- **context-builder.ts** (linha 199): Mudar `24 * 60 * 60 * 1000` para `12 * 60 * 60 * 1000`
- **publicCartStore.ts** (linha 5): Mudar `CART_TTL_MS` de 24h para 12h
- **Nova migration SQL**: Atualizar a funcao `cleanup_expired_carts()` para usar `INTERVAL '12 hours'` em vez de `INTERVAL '24 hours'`

---

## Correcao 2: Enviar TODOS os itens de uma categoria

Quando o cliente pergunta "tem bebidas?", o sistema retorna no maximo 5 resultados. Precisa enviar todos os produtos da categoria.

**Alteracoes:**

- **smart-search.ts** (linha 310-312): Quando e busca por categoria sem query textual, remover o `slice(0, maxResults)` - retornar todos os produtos da categoria
- **index.ts** (linha 1389): Quando a busca e apenas por categoria (sem query), usar `max_results = 50` (ou sem limite) em vez de 5
- **base-tools.ts** (linha 189): Atualizar descricao do parametro `max_results` para indicar que categorias completas sao retornadas sem limite
- **conversational-ai-prompt.ts**: Adicionar regra explicita na Secao 4 (Tools): "Quando cliente pergunta por uma categoria inteira (ex: 'tem bebidas?', 'quais pizzas tem?'), use search_menu(category: 'X') SEM max_results para retornar TODOS os produtos da categoria. Liste TODOS na resposta."

---

## Correcao 3: Status Aberto/Fechado dinamico baseado no dia da semana

O campo `restaurant.is_open` e estatico na base de dados. O agente precisa calcular o status real com base no dia da semana atual e nos horarios configurados (`opening_hours`).

**Alteracoes em context-builder.ts** (funcao `formatRestaurantInfoForPrompt`, linhas 631-668):

- Calcular o dia da semana atual usando o timezone do restaurante (funcao `detectTimezone` ja existe)
- Verificar se o dia atual esta marcado como `closed: true` em `opening_hours`
- Verificar se a hora atual esta dentro do intervalo `open`-`close`
- Substituir o uso de `restaurant.is_open` pelo status calculado dinamicamente
- O formato final fica: `Status: Aberto (Fecha as 23:00)` ou `Status: Fechado (Abre amanha as 11:00)` ou `Status: Fechado (Hoje nao abrimos)`

Isto garante que o agente nunca diz "Aberto" num dia em que o restaurante esta fechado.

---

## Correcao 4: Perguntar bebida do combo

O agente nao sabe que combos incluem bebida a escolher. Precisa de instrucoes explicitas no prompt.

**Alteracoes em conversational-ai-prompt.ts:**

- Adicionar nova regra na Secao 4 (Tools) ou criar subsecao "REGRAS DE COMBO":

```text
REGRAS DE COMBO:
- Quando o cliente escolher um COMBO/MENU, SEMPRE pergunte qual bebida quer
- Use search_menu(category: "Bebidas") para mostrar as opcoes disponiveis
- So adicione o combo ao carrinho DEPOIS de saber a bebida
- Se o combo tem addons do tipo bebida, use get_product_addons(product_id) primeiro
```

- Adicionar na Secao 5 (Checklist): "Se item e combo, perguntei a bebida?"

---

## Detalhes Tecnicos

### Migration SQL (Correcao 1)

```text
CREATE OR REPLACE FUNCTION public.cleanup_expired_carts()
  - Alterar INTERVAL '24 hours' para INTERVAL '12 hours' em todos os pontos
  - Alterar INTERVAL '25 hours' para INTERVAL '13 hours' no reset de states
```

### Smart Search - Categoria sem limite (Correcao 2)

```text
Na funcao smartSearchProducts, quando category esta definido e query esta vazio:
  - Retornar filtered (sem slice) em vez de filtered.slice(0, maxResults)
  
No executeToolCall case 'search_menu':
  - Se category definido e query vazio: forcar max_results = 100
```

### Status Dinamico (Correcao 3)

```text
Nova funcao: isRestaurantCurrentlyOpen(restaurant)
  1. Detectar timezone com detectTimezone(restaurant)
  2. Obter dia da semana atual no timezone local
  3. Verificar opening_hours[dia].closed
  4. Comparar hora atual com opening_hours[dia].open e .close
  5. Retornar { isOpen: boolean, message: string }

Usar na formatRestaurantInfoForPrompt em vez de restaurant.is_open
```

### Regras de Combo no Prompt (Correcao 4)

```text
Adicionar secao entre Secao 4 e 5 do prompt:
- Detecao de combo: produto com "combo" ou "menu" no nome
- Obrigatoriedade de perguntar bebida antes de add_to_cart
- Uso de get_product_addons ou search_menu para listar opcoes
```
