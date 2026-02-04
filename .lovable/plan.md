

# Plano: Pedidos em Mesa no Menu Digital

## Resumo
Adicionar a funcionalidade de "Consumo no Local" (dine-in) e "Take and Go" ao checkout do menu público, permitindo que clientes escolham entre entrega, mesa ou levantar no balcão.

---

## Fase 1: Base de Dados

### 1.1 Migração SQL

```sql
-- Adicionar configurações de mesa ao restaurant_settings
ALTER TABLE public.restaurant_settings 
ADD COLUMN IF NOT EXISTS dine_in_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS dine_in_require_table_number BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS dine_in_table_prefix TEXT DEFAULT 'Mesa',
ADD COLUMN IF NOT EXISTS takeaway_enabled BOOLEAN DEFAULT false;

-- Adicionar campos de tipo de pedido às web_orders
ALTER TABLE public.web_orders 
ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'delivery' 
  CHECK (order_type IN ('delivery', 'dine_in', 'takeaway')),
ADD COLUMN IF NOT EXISTS table_number TEXT;

-- Comentários de documentação
COMMENT ON COLUMN public.restaurant_settings.dine_in_enabled IS 
  'Habilita opção de pedido em mesa no checkout';
COMMENT ON COLUMN public.restaurant_settings.takeaway_enabled IS 
  'Habilita opção Take and Go no checkout';
COMMENT ON COLUMN public.web_orders.order_type IS 
  'Tipo de pedido: delivery, dine_in (mesa), takeaway (Take and Go)';
COMMENT ON COLUMN public.web_orders.table_number IS 
  'Número da mesa para pedidos dine_in';
```

---

## Fase 2: Alterações no Checkout

### 2.1 Fluxo do Checkout com Seleção de Tipo

```text
┌─────────────────────────────────────────────────────────────┐
│ COMO DESEJA RECEBER SEU PEDIDO?                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  🚚 Entrega  │  │  🍽️ Na Mesa  │  │ 🛍️ Take & Go │      │
│  │              │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

[Se "Na Mesa" selecionado:]
┌─────────────────────────────────────────────────────────────┐
│ IDENTIFICAÇÃO DA MESA                                       │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ Número da Mesa: [    12    ]                                │
│                                                             │
│ ℹ️ Indique o número da sua mesa para recebermos o pedido    │
└─────────────────────────────────────────────────────────────┘

[Se "Take & Go" selecionado:]
┌─────────────────────────────────────────────────────────────┐
│ 🛍️ TAKE AND GO                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ ℹ️ Retire o seu pedido no balcão quando estiver pronto      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Lógica Condicional

| Tipo de Pedido | Endereço | Mesa | Taxa de Entrega |
|----------------|----------|------|-----------------|
| 🚚 Entrega | Obrigatório | - | Calculada |
| 🍽️ Na Mesa | Oculto | Obrigatório* | €0.00 |
| 🛍️ Take & Go | Oculto | - | €0.00 |

*Configurável pelo restaurante

---

## Fase 3: Configurações do Restaurante

### 3.1 Nova Secção em PublicMenuTab.tsx

```text
┌─────────────────────────────────────────────────────────────┐
│ 🍽️ Modos de Pedido                                          │
│ Configure como os clientes podem fazer pedidos              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [x] Entrega (Delivery)                                     │
│     Pedidos com endereço de entrega                        │
│                                                             │
│ [ ] Consumo no Local (Mesa)                                │
│     Clientes indicam número da mesa                        │
│                                                             │
│     Número da mesa obrigatório: [x]                        │
│     Prefixo: [Mesa] (ex: "Mesa 12")                        │
│                                                             │
│ [ ] Take and Go                                            │
│     Cliente retira no balcão                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Fase 4: Exibição no Painel de Pedidos

### 4.1 Badges Visuais

| Tipo | Badge | Cor |
|------|-------|-----|
| Entrega | 🚚 Entrega | Azul |
| Mesa | 🍽️ Mesa 12 | Amarelo |
| Take & Go | 🛍️ Take & Go | Verde |

### 4.2 OrderDetailsPanel

```text
[Para pedidos Na Mesa:]
┌─────────────────────────────────────────┐
│ 📍 LOCAL                                │
│ ─────────────────────────────────────── │
│ 🍽️ Consumo no Local                     │
│ Mesa: 12                                │
└─────────────────────────────────────────┘

[Para pedidos Take & Go:]
┌─────────────────────────────────────────┐
│ 📍 LOCAL                                │
│ ─────────────────────────────────────── │
│ 🛍️ Take and Go                          │
│ Retirar no balcão                      │
└─────────────────────────────────────────┘
```

---

## Fase 5: Página de Confirmação

### 5.1 Mensagens Adaptadas

**Entrega:**
> "Seu pedido foi recebido e está sendo preparado. Você receberá em breve no endereço informado."

**Na Mesa:**
> "Seu pedido foi recebido e está sendo preparado. Entregaremos na Mesa 12."

**Take & Go:**
> "Seu pedido foi recebido e está sendo preparado. Por favor, dirija-se ao balcão quando for chamado."

---

## Fase 6: Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx_dine_in_feature.sql` | Novo | Campos de mesa e takeaway |
| `src/integrations/supabase/types.ts` | Atualizado | Regenerar tipos |
| `src/types/public-menu.ts` | Modificar | Adicionar order_type, table_number |
| `src/pages/public/PublicCheckout.tsx` | Modificar | Seleção de tipo de pedido |
| `src/pages/public/PublicOrderConfirmed.tsx` | Modificar | Mensagens por tipo |
| `src/components/settings/PublicMenuTab.tsx` | Modificar | Configurações dine-in/takeaway |
| `src/components/OrderDetailsPanel.tsx` | Modificar | Exibir info de mesa/takeaway |
| `src/components/orders/OrdersKanban.tsx` | Modificar | Badge de tipo |
| `src/components/orders/OrdersList.tsx` | Modificar | Indicador de tipo |
| `supabase/functions/notify-web-order/index.ts` | Modificar | Incluir tipo na notificação |

---

## Fase 7: Notificação WhatsApp

Atualizar `notify-web-order` para incluir o tipo de pedido:

```text
🆕 NOVO PEDIDO #ABC123

📦 Tipo: 🍽️ Na Mesa (Mesa 12)
👤 João Silva
📱 +351 912 345 678

🛒 Itens:
- 2x Pizza Margherita
- 1x Coca-Cola

💰 Total: €27.50
```

---

## Resumo de Implementação

### Prioridade 1 (MVP)
1. Criar migração SQL com novos campos
2. Modificar PublicCheckout.tsx com seleção de tipo
3. Adaptar criação do web_order
4. Atualizar OrderDetailsPanel

### Prioridade 2 (Completo)
5. Adicionar configurações em PublicMenuTab
6. Modificar notificação WhatsApp
7. Adicionar badges no Kanban/Lista
8. Adaptar página de confirmação

### Prioridade 3 (Futuro)
9. Geração de QR Codes por mesa com pré-preenchimento
10. Estimativa de tempo para Take & Go

