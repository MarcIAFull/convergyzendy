

# Plano de Integração: ZoneSoft POS

## Objetivo
Integrar o sistema ZoneSoft (POS/Sistema de Cozinha) para permitir que restaurantes enviem pedidos confirmados diretamente para o sistema de caixa e cozinha, onde são impressos os tickets/cupons.

---

## Análise da Documentação ZoneSoft

### Visão Geral da API
A ZoneSoft API V3 é uma REST API que permite:
- **Criar documentos de venda** (Tickets, Faturas, etc.) via `Documents::saveInstances`
- **Sincronizar produtos** via `Products::getInstances`
- **Gerir clientes** via `Clients::saveInstances`
- **Consultar pedidos** via `Documents::getInstances`

### Autenticação
A API usa autenticação via headers HMAC:

| Header | Descrição |
|--------|-----------|
| `X-ZS-CLIENT-ID` | ID do cliente (loja) na ZoneSoft |
| `X-ZS-APP-KEY` | Chave da aplicação registada |
| `X-ZS-SIGNATURE` | HMAC-SHA256 do body com o `app_secret` |

### Endpoints Principais

| Interface | Ação | Descrição |
|-----------|------|-----------|
| `documents` | `saveInstances` | Criar documentos (pedidos/tickets) |
| `documents` | `getInstances` | Consultar documentos |
| `products` | `getInstances` | Listar produtos do POS |
| `clients` | `saveInstances` | Criar/atualizar clientes |

### URLs da API
- **URL Base**: `https://api.zonesoft.org/v3/`
- **Formato**: `POST {base}/{interface}/{action}`

---

## Fase 1: Configuração de Base de Dados

### 1.1 Migração SQL - Novas Tabelas

```sql
-- Configuração ZoneSoft por restaurante
CREATE TABLE restaurant_zonesoft_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  
  -- Credenciais API
  client_id TEXT,              -- X-ZS-CLIENT-ID
  app_key TEXT,                -- X-ZS-APP-KEY
  app_secret TEXT,             -- Para gerar X-ZS-SIGNATURE
  
  -- Configuração da Loja
  store_id INTEGER,            -- loja no ZoneSoft
  warehouse_id INTEGER,        -- armazem padrão
  operator_id INTEGER,         -- empid (operador)
  document_type TEXT DEFAULT 'TK',  -- Tipo de documento (TK=Ticket, VD=Venda, etc)
  document_series TEXT,        -- Série do documento (ex: W2024L5)
  payment_type_id INTEGER DEFAULT 1, -- Tipo de pagamento padrão
  
  -- Mapeamento
  products_synced_at TIMESTAMPTZ,
  sync_mode TEXT DEFAULT 'manual' CHECK (sync_mode IN ('manual', 'auto')),
  
  -- Metadados
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mapeamento de produtos (nosso sistema -> ZoneSoft)
CREATE TABLE zonesoft_product_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  local_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  zonesoft_product_id INTEGER NOT NULL,
  zonesoft_product_code TEXT,
  zonesoft_product_name TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, local_product_id)
);

-- Log de sincronizações ZoneSoft
CREATE TABLE zonesoft_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'send_order', 'sync_products', 'get_document'
  status TEXT NOT NULL, -- 'success', 'error', 'pending'
  zonesoft_document_number INTEGER,
  zonesoft_document_type TEXT,
  zonesoft_document_series TEXT,
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_zonesoft_product_mapping_restaurant ON zonesoft_product_mapping(restaurant_id);
CREATE INDEX idx_zonesoft_product_mapping_local ON zonesoft_product_mapping(local_product_id);
CREATE INDEX idx_zonesoft_sync_logs_order ON zonesoft_sync_logs(order_id);
CREATE INDEX idx_zonesoft_sync_logs_restaurant ON zonesoft_sync_logs(restaurant_id);

-- Adicionar campo na orders para tracking ZoneSoft
ALTER TABLE orders ADD COLUMN zonesoft_document_number INTEGER;
ALTER TABLE orders ADD COLUMN zonesoft_document_type TEXT;
ALTER TABLE orders ADD COLUMN zonesoft_document_series TEXT;
ALTER TABLE orders ADD COLUMN zonesoft_synced_at TIMESTAMPTZ;

-- RLS
ALTER TABLE restaurant_zonesoft_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonesoft_product_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonesoft_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant zonesoft config" ON restaurant_zonesoft_config
  FOR ALL USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_owners WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage product mappings" ON zonesoft_product_mapping
  FOR ALL USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_owners WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view sync logs" ON zonesoft_sync_logs
  FOR SELECT USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_owners WHERE user_id = auth.uid()
  ));
```

---

## Fase 2: Edge Functions

### 2.1 `zonesoft-api` - Função Principal

Responsabilidades:
- Gerar assinatura HMAC-SHA256
- Executar chamadas à API ZoneSoft
- Gerir rate limiting (máx 20 req/2s)

Ações suportadas:
- `test-connection` - Testar credenciais
- `sync-products` - Sincronizar produtos do ZoneSoft
- `send-order` - Enviar pedido confirmado
- `get-document` - Consultar documento

### 2.2 Implementação da Assinatura

```typescript
// Gerar X-ZS-SIGNATURE
const generateSignature = (body: string, appSecret: string): string => {
  const encoder = new TextEncoder();
  const key = encoder.encode(appSecret);
  const data = encoder.encode(body);
  
  // HMAC-SHA256
  const signature = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, data));
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};
```

### 2.3 Estrutura do Documento (Pedido)

```json
{
  "document": [{
    "doc": "TK",                        // Tipo: Ticket
    "serie": "W2024L5",                 // Série configurada
    "loja": 5,                          // Store ID
    "cliente": 0,                       // Cliente (0 = consumidor final)
    "nome": "João Silva",               // Nome do cliente
    "telefone": "+351912345678",        // Telefone
    "morada": "Rua X, 123, Lisboa",     // Endereço de entrega
    "pagamento": 1,                     // Tipo de pagamento
    "emp": 100,                         // Operador ID
    "data": "2024-02-04",               // Data
    "datahora": "2024-02-04 14:30:00",  // Data/hora
    "observacoes": "Sem cebola",        // Observações
    "ivaincluido": 1,                   // IVA incluído
    "vendas": [                         // Linhas do pedido
      {
        "codigo": 123,                  // Código do produto no ZoneSoft
        "descricao": "Pizza Margherita",
        "qtd": 2,
        "punit": 12.50,
        "iva": 23,
        "total": 25.00
      }
    ]
  }]
}
```

---

## Fase 3: Fluxo de Integração

### 3.1 Configuração Inicial

```text
1. Restaurante acede a Configurações > Integrações > ZoneSoft
2. Introduz credenciais (Client ID, App Key, App Secret)
3. Configura Store ID, Warehouse ID, Operador
4. Testa conexão
5. Sincroniza produtos do ZoneSoft
6. Mapeia produtos locais aos produtos ZoneSoft
```

### 3.2 Envio de Pedido

```text
1. Pedido é confirmado no nosso sistema
2. Sistema verifica se restaurante tem ZoneSoft ativo
3. Converte itens do pedido para formato ZoneSoft
   - Busca mapeamento de produtos
   - Produtos sem mapeamento: usa nome/preço original
4. Chama POST documents/saveInstances
5. Guarda número do documento retornado
6. Atualiza order com zonesoft_document_number
7. Ticket é impresso automaticamente no POS
```

### 3.3 Diagrama de Fluxo

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Pedido    │────▶│   Edge Fn    │────▶│  ZoneSoft   │
│  Confirmado │     │ zonesoft-api │     │    API      │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐     ┌─────────────┐
                    │  sync_logs   │     │  Impressão  │
                    │   (DB)       │     │   Ticket    │
                    └──────────────┘     └─────────────┘
```

---

## Fase 4: Interface do Utilizador

### 4.1 Tab ZoneSoft em Configurações

```text
┌─────────────────────────────────────────────────────────────┐
│ 🖨️ ZoneSoft POS                                            │
│ Integre com o sistema ZoneSoft para impressão automática   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [x] Ativar Integração ZoneSoft                             │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ CREDENCIAIS API                                             │
│                                                             │
│ Client ID:    [________________________]                    │
│ App Key:      [________________________]                    │
│ App Secret:   [••••••••••••••••••] 👁                       │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ CONFIGURAÇÃO DA LOJA                                        │
│                                                             │
│ Store ID (loja):        [____]                              │
│ Warehouse ID (armazem): [____]                              │
│ Operator ID (emp):      [____]                              │
│ Tipo de Documento:      [TK - Ticket    ▼]                  │
│ Série:                  [________________]                  │
│ Tipo de Pagamento:      [Numerário      ▼]                  │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ SINCRONIZAÇÃO DE PRODUTOS                                   │
│                                                             │
│ Última sincronização: 04/02/2024 14:30                     │
│ Produtos mapeados: 45/50                                    │
│                                                             │
│ [Sincronizar Produtos]  [Mapear Produtos]                   │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ [Testar Conexão]                    [Guardar Configurações] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Modal de Mapeamento de Produtos

```text
┌─────────────────────────────────────────────────────────────┐
│ Mapear Produtos                                       [X]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🔍 [Pesquisar produto...]                                   │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ NOSSO PRODUTO          │ PRODUTO ZONESOFT              │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Pizza Margherita       │ [Pizza Marg. (cod: 123) ▼]   │ │
│ │ Pizza Pepperoni        │ [Pizza Pep. (cod: 124)  ▼]   │ │
│ │ Coca-Cola 33cl         │ [Coca Cola (cod: 50)    ▼]   │ │
│ │ Hambúrguer Classic     │ [Não mapeado           ▼]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ⚠️ Produtos não mapeados serão enviados com nome/preço     │
│    original mas podem não aparecer no relatório ZoneSoft   │
│                                                             │
│                                        [Guardar Mapeamento] │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Indicador no Painel do Pedido

```text
┌─────────────────────────────────────────┐
│ INTEGRAÇÃO POS                          │
│ ─────────────────────────────────────── │
│ ZoneSoft: ✅ Enviado                    │
│ Documento: TK W2024L5/1234              │
│ Enviado em: 04/02/2024 14:35           │
│                                         │
│ [Reenviar para POS] (se erro)          │
└─────────────────────────────────────────┘
```

---

## Fase 5: Arquivos a Criar/Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/xxx_zonesoft_integration.sql` | Novo | Schema de base de dados |
| `supabase/functions/zonesoft-api/index.ts` | Novo | Edge function principal |
| `supabase/config.toml` | Modificar | Adicionar configuração da função |
| `src/types/zonesoft.ts` | Novo | Tipos TypeScript |
| `src/stores/zonesoftStore.ts` | Novo | Estado da integração |
| `src/components/settings/ZoneSoftTab.tsx` | Novo | Tab de configuração |
| `src/components/settings/ZoneSoftProductMapping.tsx` | Novo | Modal de mapeamento |
| `src/components/orders/ZoneSoftSyncPanel.tsx` | Novo | Painel no detalhe do pedido |
| `src/pages/SettingsUnified.tsx` | Modificar | Adicionar tab ZoneSoft |
| `src/components/OrderDetailsPanel.tsx` | Modificar | Integrar painel de sync |

---

## Fase 6: Trigger Automático (Opcional)

Para envio automático quando o pedido é confirmado:

```sql
-- Trigger para enviar automaticamente ao ZoneSoft
CREATE OR REPLACE FUNCTION notify_zonesoft_on_order_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Verificar se restaurante tem ZoneSoft ativo
    IF EXISTS (
      SELECT 1 FROM restaurant_zonesoft_config 
      WHERE restaurant_id = NEW.restaurant_id 
      AND enabled = true
    ) THEN
      -- Inserir job na fila de sincronização
      INSERT INTO zonesoft_sync_logs (
        restaurant_id, order_id, action, status
      ) VALUES (
        NEW.restaurant_id, NEW.id, 'send_order', 'pending'
      );
      
      -- Notificar via pg_notify para processamento
      PERFORM pg_notify('zonesoft_sync', json_build_object(
        'order_id', NEW.id,
        'restaurant_id', NEW.restaurant_id
      )::text);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_confirmed_zonesoft
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_zonesoft_on_order_confirmed();
```

---

## Fase 7: Considerações Técnicas

### Rate Limiting
- ZoneSoft tem limite de 20 requests por 2 segundos
- Implementar queue com debounce para envios em lote

### Tratamento de Erros
| Código | Descrição | Ação |
|--------|-----------|------|
| 200/201 | Sucesso | Guardar número do documento |
| 401 | Não autorizado | Verificar credenciais |
| 422 | Dados inválidos | Mostrar erro específico |
| 429 | Rate limit | Retry com backoff |
| 500 | Erro servidor | Retry ou notificar |

### Segurança
- `app_secret` guardado encriptado na BD
- Nunca expor credenciais no frontend
- Todas as chamadas via edge function

---

## Fase 8: Próximos Passos

### Prioridade 1 (MVP)
1. Criar tabelas de configuração e mapeamento
2. Implementar edge function com assinatura HMAC
3. Criar tab de configuração no Settings
4. Implementar envio manual de pedido

### Prioridade 2 (Melhorias)
5. Adicionar sincronização de produtos
6. Criar modal de mapeamento
7. Implementar envio automático via trigger

### Prioridade 3 (Avançado)
8. Sincronização bidirecional de stock
9. Relatórios de vendas unificados
10. Suporte a múltiplas séries de documentos

---

## Requisitos para Implementação

### Do lado do cliente
1. **Licença ZS Rest ativa** na ZoneSoft
2. **Módulo ZSAPIFood (Developer) ativado** - solicitar à ZoneSoft
3. **Registo na plataforma de integração**: developer.zonesoft.org
4. **Credenciais de API** (Client ID, App Key, App Secret)
5. **Store ID** da loja a integrar

### Documentação de Referência
- Portal Developer: https://developer.zonesoft.org
- Documentação API: Fornecida nos PDFs
- Suporte: geral@zonesoft.org

