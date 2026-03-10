

## Plano: Combos com Etapas de Addons + Duplicação de Produtos

### Contexto Atual

- Produtos têm addons "flat" (lista simples ligada por `product_id`)
- Não existe conceito de agrupamento/etapas nos addons
- Não existe funcionalidade de duplicar produtos
- O sistema de addons é usado tanto no menu público, no WhatsApp AI agent, como no backoffice

### Funcionalidade 1: Duplicar Produto

Abordagem simples e sem risco — apenas frontend + store.

**Alterações:**
- `src/pages/MenuManagement.tsx`: Adicionar botão "Duplicar" no card de cada produto (ícone Copy)
- `src/stores/menuStore.ts`: Nova action `duplicateProduct(productId, restaurantId)` que:
  1. Lê o produto original e seus addons
  2. Insere novo produto com nome `"{nome} (cópia)"` na mesma categoria
  3. Copia todos os addons do original para o novo produto
  4. Faz `fetchMenu` para atualizar

**Impacto:** Zero — não altera nenhuma estrutura existente.

### Funcionalidade 2: Combos com Etapas de Addons

Esta é a funcionalidade mais complexa. A ideia é permitir agrupar addons em "etapas" (ex: Etapa 1 - Bebida, Etapa 2 - Sobremesa, Etapa 3 - Adicionais), cada etapa com as suas regras (mín/máx seleções, grátis ou não).

**Nova tabela: `addon_groups`**
```sql
CREATE TABLE addon_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,           -- "Escolha a Bebida", "Sobremesa", "Adicionais"
  sort_order INTEGER DEFAULT 0,
  min_selections INTEGER DEFAULT 0,  -- mínimo obrigatório (0 = opcional)
  max_selections INTEGER,            -- máximo permitido (NULL = sem limite)
  free_selections INTEGER DEFAULT 0, -- quantos são grátis nesta etapa
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Alteração na tabela `addons`:**
```sql
ALTER TABLE addons ADD COLUMN group_id UUID REFERENCES addon_groups(id) ON DELETE SET NULL;
```

- Addons sem `group_id` continuam a funcionar exactamente como antes (retrocompatibilidade total)
- Addons com `group_id` pertencem a uma etapa específica

**Ficheiros a alterar no frontend:**

1. `src/types/database.ts` — Adicionar interface `AddonGroup`, atualizar `Addon` com `group_id` opcional
2. `src/stores/menuStore.ts` — Ações CRUD para `addon_groups`, fetch de grupos junto com addons
3. `src/pages/MenuManagement.tsx` — UI para gerir grupos de addons por produto (criar etapa, arrastar addons entre etapas)
4. `src/components/public/ProductModal.tsx` — Renderizar addons agrupados por etapa com validação min/max por grupo
5. `src/stores/publicMenuStore.ts` — Fetch de addon_groups junto com o menu público

**Ficheiros a alterar no backend (Edge Functions):**

6. `supabase/functions/whatsapp-ai-agent/context-builder.ts` — Incluir grupos de addons no contexto do agente
7. `supabase/functions/whatsapp-ai-agent/base-tools.ts` — Atualizar `add_to_cart` e `get_product_addons` para incluir info de grupos

**RLS para `addon_groups`:**
- SELECT público se menu_enabled (como addons)
- ALL para authenticated com `user_has_restaurant_access`

### Compatibilidade Retroativa

Ponto crítico: produtos existentes sem grupos continuam a funcionar porque:
- `group_id` é nullable no `addons` — addons existentes ficam sem grupo
- O ProductModal renderiza addons sem grupo numa secção "Adicionais" genérica
- O AI agent trata addons sem grupo como lista flat (comportamento atual)
- Apenas quando existem `addon_groups` para um produto é que a UI mostra as etapas

### Ordem de Implementação

1. Migração DB: criar `addon_groups` + adicionar `group_id` ao `addons`
2. Duplicar Produto (independente, pode ir primeiro)
3. CRUD de addon_groups no MenuManagement
4. UI de etapas no ProductModal público
5. Atualizar contexto do AI agent

### Resumo de Ficheiros

| Ficheiro | Alteração |
|---|---|
| DB Migration | Tabela `addon_groups` + coluna `group_id` |
| `src/types/database.ts` | Interface `AddonGroup` |
| `src/stores/menuStore.ts` | Ações CRUD grupos + `duplicateProduct` |
| `src/pages/MenuManagement.tsx` | UI grupos + botão duplicar |
| `src/components/public/ProductModal.tsx` | Renderização por etapas |
| `src/stores/publicMenuStore.ts` | Fetch addon_groups |
| `context-builder.ts` | Contexto com grupos |
| `base-tools.ts` | Tool info com grupos |

