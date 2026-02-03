
# Plano de Correção: Problemas no Atendimento IA do Supremo Açaí

## Análise dos Problemas Identificados

### Problema 1: IA Adiciona Itens Sem o Cliente Pedir
**Sintoma (Vídeo 1):**
- Cliente: "Quero um Açaí"  
- IA: "Adicionei Açaí G + 2x Açaí M com banana, mel, granola, paçoca..."

**Causa Raiz:**
- A IA está "alucinando" pedidos anteriores ou inferindo itens que não foram solicitados
- O histórico de conversa pode estar contaminado com pedidos de outras sessões
- Falta de validação explícita antes de adicionar ao carrinho

---

### Problema 2: Cálculo Incorreto de Preço dos Complementos
**Sintoma (Vídeo 2):**
- Cliente pede Açaí M (€8) com 4 complementos
- IA cobra €12 em vez de €8 (4 complementos deveriam ser grátis)
- Cliente: "Eu tenho direito a 4 complementos grátis!"
- IA: "Cada complemento adicional tem custo de €1"

**Causa Raiz:**
- O campo `max_addons` nos produtos está `NULL` (não configurado)
- A descrição do produto diz "4 complementos grátis", mas isso é texto livre
- O sistema não tem conceito de "primeiros N addons são grátis"
- Todos os addons têm `price: 1.00` e estão sendo somados

---

### Problema 3: IA Não Entende Regra de Gratuidade
**Sintoma:**
- IA diz "4 complementos grátis" mas calcula cobrando €1 por cada

**Causa Raiz:**
- O campo `max_addons` limita QUANTIDADE, não define gratuidade
- Falta um campo `free_addons_count` para definir quantos são grátis
- A lógica de cálculo em `add_to_cart` soma TODOS os preços

---

### Problema 4: Casadinho Sem Complementos
**Sintoma (Vídeo 1):**
- Cliente pede Casadinho P
- IA: "não há complementos disponíveis para este tamanho"

**Causa Raiz:**
- O produto "CASADINHOS: P 200 ML" não tem addons cadastrados
- Apenas os tamanhos de Açaí (P, M, G) têm addons configurados
- A IA responde corretamente que não encontrou, mas a configuração está incompleta

---

## Plano de Ação (5 Fases)

### Fase 1: Adicionar Campo `free_addons_count` no Banco de Dados

Adicionar coluna que define quantos addons são gratuitos por produto:

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `free_addons_count` | INTEGER | NULL | Número de addons grátis (NULL = nenhum grátis) |

Atualizar produtos do Supremo Açaí:
- Açaí P/M/G → `free_addons_count = 4`
- Casadinhos → `free_addons_count = 4`
- Outros → `free_addons_count = NULL` (nenhum grátis)

**Migração SQL:**
```sql
ALTER TABLE products ADD COLUMN free_addons_count INTEGER DEFAULT NULL;

-- Aplicar para produtos de Açaí do Supremo
UPDATE products SET free_addons_count = 4 
WHERE name ILIKE '%açaí%' OR name ILIKE '%casadinho%';
```

---

### Fase 2: Atualizar Lógica de Cálculo no `add_to_cart`

Modificar a ferramenta para calcular corretamente addons grátis vs pagos:

```text
ANTES:
addonsTotal = soma de TODOS os addons

DEPOIS:
freeAddonsCount = product.free_addons_count || 0
paidAddons = validatedAddons.slice(freeAddonsCount)
freeAddons = validatedAddons.slice(0, freeAddonsCount)
addonsTotal = paidAddons.reduce(sum => addon.price)
```

Retornar informação clara na resposta:
- `free_addons: [{name, price}]`  
- `paid_addons: [{name, price}]`
- `addons_total: X` (apenas os pagos)

---

### Fase 3: Atualizar `search_menu` e Contexto do Menu

Incluir `free_addons_count` nos resultados de busca:

```text
Açaí M - 300ml (ID: xxx) - €8.00
  → 4 complementos GRÁTIS inclusos
  → Complementos extras: €1.00/cada
  → Addons disponíveis: Banana, Morango, Nutella, ...
```

Atualizar o prompt para incluir regra clara:
```text
REGRA DE COMPLEMENTOS:
- Produtos com free_addons_count > 0 incluem X complementos grátis
- Complementos além do limite são cobrados pelo preço do addon
- SEMPRE informar ao cliente: "Você tem direito a X complementos grátis"
```

---

### Fase 4: Adicionar Validação Anti-Alucinação

Implementar checagens para evitar que a IA adicione itens não solicitados:

1. **Log de auditoria antes de add_to_cart:**
   - Verificar se o produto foi mencionado pelo cliente na mensagem atual
   - Validar que o cliente CONFIRMOU o item antes de adicionar

2. **Limpar histórico de carrinho entre sessões:**
   - Se carrinho está inativo há mais de X horas, limpar e começar novo

3. **Instruções explícitas no prompt:**
   ```text
   REGRA CRÍTICA:
   - NUNCA adicione produtos que o cliente NÃO mencionou explicitamente
   - Se cliente diz "quero um açaí", pergunte qual tamanho (P/M/G)
   - Só adicione ao carrinho APÓS confirmação do cliente
   - Antes de add_to_cart, sempre use search_menu para obter o ID correto
   ```

---

### Fase 5: Configurar Addons para Casadinhos

Copiar os addons dos Açaís para os produtos Casadinho:

```sql
-- Copiar addons do Açaí M para os Casadinhos
INSERT INTO addons (product_id, name, price)
SELECT 'id-casadinho-p', name, price FROM addons WHERE product_id = 'id-acai-m'
UNION ALL
SELECT 'id-casadinho-m', name, price FROM addons WHERE product_id = 'id-acai-m'
UNION ALL  
SELECT 'id-casadinho-g', name, price FROM addons WHERE product_id = 'id-acai-m';
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| SQL Migration | Adicionar `free_addons_count` em `products` |
| `src/types/database.ts` | Adicionar `free_addons_count?: number \| null` |
| `src/pages/MenuManagement.tsx` | Campo de entrada para "Complementos grátis" |
| `whatsapp-ai-agent/context-builder.ts` | Incluir `free_addons_count` no contexto |
| `whatsapp-ai-agent/index.ts` | Calcular addons grátis vs pagos no `add_to_cart` |
| `whatsapp-ai-agent/smart-search.ts` | Retornar `free_addons_count` nos resultados |
| `agent_prompt_blocks` (DB) | Adicionar regra explícita de complementos grátis |
| SQL Migration | Configurar Supremo Açaí com valores corretos |

---

## Resultado Esperado

### Cenário 1: Açaí com 4 Complementos (Grátis)
```
Cliente: "Quero um Açaí M com morango, banana, nutella e granola"
IA: "Açaí M - €8.00 com 4 complementos inclusos (morango, banana, nutella, granola). 
     Mais alguma coisa? 😋"
```

### Cenário 2: Açaí com 5 Complementos (1 Pago)
```
Cliente: "Quero Açaí M com morango, banana, nutella, granola e kinder"
IA: "Açaí M - €8.00
     4 complementos grátis: morango, banana, nutella, granola
     1 extra pago: kinder (+€1)
     Total: €9.00
     Posso adicionar?"
```

### Cenário 3: Evitar Alucinação
```
Cliente: "Quero um açaí"
IA: "Temos Açaí P (€6), M (€8) e G (€10). Todos com 4 complementos grátis! 
     Qual tamanho preferes?"
```
(IA não adiciona nada ao carrinho até cliente confirmar tamanho)

---

## Prioridade de Implementação

1. **URGENTE**: Fase 2 (Cálculo correto de preços) - Impacta vendas diretamente
2. **ALTA**: Fase 1 (Campo `free_addons_count`) - Prerequisito para Fase 2
3. **ALTA**: Fase 4 (Anti-alucinação) - Impacta experiência do cliente
4. **MÉDIA**: Fase 3 (Contexto do menu) - Melhora comunicação
5. **BAIXA**: Fase 5 (Addons Casadinho) - Configuração específica do restaurante
