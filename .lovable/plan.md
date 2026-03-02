

## Diagnóstico

Existem dois problemas:

### 1. Mismatch de status entre Kanban e Edge Function
O Kanban envia os status `out_for_delivery` e `completed`, mas a edge function `notify-order-status` espera `delivering` e `delivered`. Resultado: nenhuma mensagem é enviada para esses estados (retorna `null` no `buildStatusMessage`).

O status `ready` também não existe no Kanban — o fluxo é `new → preparing → out_for_delivery → completed`.

### 2. Mensagens hardcoded e não configuráveis
As mensagens estão hardcoded na edge function. Cada restaurante deveria poder personalizar o texto de cada notificação e ativar/desativar individualmente.

---

## Plano de Implementação

### 1. Migração: Adicionar coluna `order_notifications` ao `restaurant_ai_settings`
Adicionar um campo JSONB ao `restaurant_ai_settings` com a configuração de notificações por status:

```sql
ALTER TABLE restaurant_ai_settings 
ADD COLUMN order_notifications jsonb DEFAULT '{
  "preparing": {"enabled": true, "message": "👨‍🍳 Olá {{customer_name}}! Seu pedido *#{{order_id}}* está sendo preparado! ⏳"},
  "out_for_delivery": {"enabled": true, "message": "🚚 {{customer_name}}, seu pedido *#{{order_id}}* saiu para entrega! 📍"},
  "completed": {"enabled": true, "message": "🎉 {{customer_name}}, seu pedido *#{{order_id}}* foi entregue! Obrigado! ❤️"},
  "cancelled": {"enabled": true, "message": "❌ {{customer_name}}, seu pedido *#{{order_id}}* foi cancelado. Entre em contato para mais informações."}
}'::jsonb;
```

### 2. Edge Function `notify-order-status`: Buscar config do restaurante
- Buscar `order_notifications` da tabela `restaurant_ai_settings` do restaurante
- Se o status não estiver configurado ou estiver `enabled: false`, não enviar
- Substituir variáveis de template (`{{customer_name}}`, `{{order_id}}`) na mensagem configurada
- Remover o `buildStatusMessage` hardcoded

### 3. Novo componente: `OrderNotificationsTab.tsx`
- Criar componente de configuração dentro das settings do restaurante
- Para cada status (`preparing`, `out_for_delivery`, `completed`, `cancelled`): toggle on/off + campo de texto editável
- Preview em tempo real da mensagem
- Variáveis disponíveis: `{{customer_name}}`, `{{order_id}}`

### 4. Integrar na página de Settings
- Adicionar como sub-secção na tab "WhatsApp" ou como nova sub-tab na secção de IA
- Ou integrar diretamente na tab "Restaurante" como secção adicional

### Arquivos a modificar/criar
- **Migração SQL**: adicionar coluna `order_notifications` a `restaurant_ai_settings`
- **`supabase/functions/notify-order-status/index.ts`**: buscar config, usar templates dinâmicos
- **`src/components/settings/OrderNotificationsSettings.tsx`** (novo): UI de configuração
- **`src/pages/SettingsUnified.tsx`**: integrar o novo componente (sugestão: dentro da tab WhatsApp)

