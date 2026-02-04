

# Plano de Integração: Glovo On-Demand (LaaS)

## Objetivo
Integrar o serviço de estafetas da Glovo (LaaS - Logistics as a Service) para permitir que os restaurantes solicitem entregas diretamente através da plataforma.

---

## Fase 1: Configuração de Base de Dados

### 1.1 Migração SQL - Novas Tabelas e Campos

```sql
-- Configuração de integração Glovo por restaurante
CREATE TABLE restaurant_glovo_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  address_book_id UUID, -- ID do Address Book na Glovo
  webhook_secret TEXT,
  environment TEXT DEFAULT 'staging' CHECK (environment IN ('staging', 'production')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entregas Glovo
CREATE TABLE glovo_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  order_code TEXT,
  quote_id UUID,
  quote_price DECIMAL(10,2),
  final_fee DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'CREATED',
  courier_name TEXT,
  courier_phone TEXT,
  courier_latitude DECIMAL(10,7),
  courier_longitude DECIMAL(10,7),
  tracking_link TEXT,
  estimated_pickup_at TIMESTAMPTZ,
  estimated_delivery_at TIMESTAMPTZ,
  picked_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_glovo_deliveries_order_id ON glovo_deliveries(order_id);
CREATE INDEX idx_glovo_deliveries_tracking ON glovo_deliveries(tracking_number);
CREATE INDEX idx_glovo_deliveries_status ON glovo_deliveries(status);

-- Adicionar campo na tabela orders para indicar método de entrega
ALTER TABLE orders ADD COLUMN delivery_provider TEXT DEFAULT 'restaurant' 
  CHECK (delivery_provider IN ('restaurant', 'glovo', 'other'));

-- RLS
ALTER TABLE restaurant_glovo_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE glovo_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant glovo config" ON restaurant_glovo_config
  FOR ALL USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view their deliveries" ON glovo_deliveries
  FOR SELECT USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE user_id = auth.uid()
  ));
```

---

## Fase 2: Edge Functions

### 2.1 `glovo-auth` - Autenticação e Gestão de Tokens

Responsabilidades:
- Gerar access token inicial
- Renovar token automaticamente quando expirar
- Revogar token se necessário

Endpoints internos:
- `POST /glovo-auth` → Gerar/renovar token

### 2.2 `glovo-delivery` - Gestão de Entregas

Responsabilidades:
- Criar orçamento (quote)
- Criar pedido de entrega
- Cancelar entrega
- Obter status, posição do estafeta, link de tracking

Endpoints internos:
- `POST /glovo-delivery/quote` → Criar orçamento
- `POST /glovo-delivery/create` → Criar entrega a partir de quote
- `POST /glovo-delivery/cancel` → Cancelar entrega
- `GET /glovo-delivery/status/{trackingNumber}` → Status atual
- `GET /glovo-delivery/courier/{trackingNumber}` → Info do estafeta
- `GET /glovo-delivery/tracking-link/{trackingNumber}` → Link de tracking

### 2.3 `glovo-webhook` - Receber Notificações

Responsabilidades:
- Receber callbacks de STATUS_UPDATE e POSITION_UPDATE
- Atualizar tabela `glovo_deliveries`
- Notificar restaurante (via realtime ou push)

Endpoint público (verify_jwt = false):
- `POST /glovo-webhook` → Receber notificações da Glovo

---

## Fase 3: Lógica de Negócio

### 3.1 Fluxo de Criação de Entrega

```text
1. Pedido muda para status "preparing"
2. Restaurante clica "Solicitar Estafeta Glovo"
3. Sistema chama POST /glovo-delivery/quote
   - Envia: endereço pickup (restaurante), endereço delivery (cliente)
   - Recebe: quoteId, preço estimado, tempo estimado
4. Mostrar orçamento ao restaurante
5. Restaurante confirma
6. Sistema chama POST /glovo-delivery/create
   - Envia: quoteId, contacto do cliente, detalhes do pedido
   - Recebe: trackingNumber, orderCode
7. Guardar em glovo_deliveries
8. Atualizar order.delivery_provider = 'glovo'
```

### 3.2 Sincronização de Status

Via Webhook (preferencial):
- Glovo envia POST para `/glovo-webhook`
- Atualizar `glovo_deliveries.status`
- Se status = 'DELIVERED', atualizar `orders.status = 'completed'`
- Se status = 'CANCELLED', atualizar `orders.status` e notificar

Via Polling (fallback):
- Verificar periodicamente pedidos com status intermédio
- Chamar GET /status para atualizar

---

## Fase 4: Interface do Utilizador

### 4.1 Configurações do Restaurante

Adicionar nova tab ou secção em Settings:

```text
Configurações > Entregas > Glovo On-Demand

[x] Ativar Glovo On-Demand
    
Credenciais API:
- Client ID: [input]
- Client Secret: [input] (mascarado)

Ambiente: [Staging ▼] / [Produção ▼]

Endereço de Pickup:
- Endereço: [input com geocoding]
- Coordenadas: [mostrar lat/lng]
- [Botão: Registar no Glovo]

Status: ✅ Conectado | ❌ Não configurado
```

### 4.2 Detalhes do Pedido

Adicionar secção "Entrega" no painel de detalhes:

```text
┌─────────────────────────────────────────────┐
│ ENTREGA                                      │
│ ─────────────────────────────────────────── │
│ Método: [Restaurante ▼] [Glovo ▼]           │
│                                              │
│ [Se Glovo selecionado e não criado:]        │
│ Preço estimado: €3.50                       │
│ Tempo estimado: 25-35 min                   │
│ [Botão: Solicitar Estafeta]                 │
│                                              │
│ [Se Glovo criado:]                          │
│ Status: 🚴 A caminho do restaurante         │
│ Estafeta: João Silva (+351 912 345 678)     │
│ Tracking: GLV123456789                      │
│ [Link: Ver no mapa]                         │
│ [Botão: Cancelar entrega] (se possível)     │
└─────────────────────────────────────────────┘
```

### 4.3 Kanban de Pedidos

Adicionar indicador visual:

```text
Pedido #123
🛵 Glovo - Aceite
ETA: 15 min
```

---

## Fase 5: Arquivos a Criar/Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx_glovo_integration.sql` | Novo | Schema de base de dados |
| `supabase/functions/glovo-auth/index.ts` | Novo | Autenticação OAuth |
| `supabase/functions/glovo-delivery/index.ts` | Novo | Operações de entrega |
| `supabase/functions/glovo-webhook/index.ts` | Novo | Receber callbacks |
| `supabase/config.toml` | Modificar | Adicionar configurações das novas funções |
| `src/types/glovo.ts` | Novo | Tipos TypeScript para Glovo |
| `src/stores/glovoStore.ts` | Novo | Estado da integração Glovo |
| `src/components/settings/GlovoTab.tsx` | Novo | Configurações Glovo |
| `src/components/orders/GlovoDeliveryPanel.tsx` | Novo | Painel de entrega Glovo |
| `src/pages/SettingsUnified.tsx` | Modificar | Adicionar tab Glovo |
| `src/components/OrderDetailsPanel.tsx` | Modificar | Integrar painel de entrega |
| `src/components/orders/OrdersKanban.tsx` | Modificar | Indicador visual Glovo |

---

## Fase 6: Secrets e Configuração

Secrets necessários (por restaurante, guardados na tabela):
- `GLOVO_CLIENT_ID`
- `GLOVO_CLIENT_SECRET`

URLs da API:
- Staging: `https://ondemand-stageapi.glovoapp.com`
- Production: `https://ondemand-api.glovoapp.com`

---

## Considerações Técnicas

### Rate Limiting
- Máximo 20 requests por 2 segundos
- Ban de 60 segundos se exceder

### Segurança
- Credenciais Glovo guardadas encriptadas na BD
- Webhook valida `Authorization` header com `partnerSecret`
- Tokens renovados automaticamente antes de expirar

### Throttling
- Posição do estafeta atualizada via webhook (a cada 20s)
- Não fazer polling excessivo

### Disponibilidade
- Verificar `GET /v2/laas/working-areas` para horários
- Validar entrega com `POST /v2/laas/parcels/validation` antes de oferecer opção

---

## Próximos Passos Recomendados

1. **Obter credenciais de teste** junto à Glovo (contactar partner.integrationseu@glovoapp.com)
2. **Implementar Fase 1** (base de dados) e **Fase 2** (edge functions)
3. **Testar no ambiente Staging** com simulações
4. **Implementar UI** (Fase 4)
5. **Validar com restaurante piloto**
6. **Migrar para Production**

