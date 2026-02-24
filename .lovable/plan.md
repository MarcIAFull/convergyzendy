

## Notificações de Atualização de Status do Pedido via WhatsApp

### Situacao Atual

| Funcionalidade | Status |
|---|---|
| Notificar restaurante (WhatsApp) ao receber pedido web | Implementado |
| Notificar cliente (WhatsApp) com confirmacao do pedido | Implementado |
| Cliente pode continuar conversa pelo WhatsApp | Funciona naturalmente |
| Notificar cliente quando status do pedido muda | **Nao implementado** |

### O que sera feito

Quando o restaurante alterar o status de um pedido no painel (Kanban/lista), o cliente recebera automaticamente uma mensagem no WhatsApp informando a atualizacao.

### Mensagens por Status

| Status | Mensagem |
|---|---|
| preparing | "Seu pedido #ABC123 esta sendo preparado! Aguarde..." |
| ready | "Seu pedido #ABC123 esta pronto!" (para takeaway/dine_in) |
| delivering | "Seu pedido #ABC123 saiu para entrega!" (para delivery) |
| delivered | "Seu pedido #ABC123 foi entregue! Obrigado!" |
| cancelled | "Seu pedido #ABC123 foi cancelado. Entre em contato para mais informacoes." |

Pedidos do tipo `dine_in` e `takeaway` recebem mensagens adaptadas ao contexto.

### Detalhes Tecnicos

**1. Nova Edge Function: `notify-order-status`**
- Recebe: `order_id`, `restaurant_id`, `new_status`
- Busca o pedido na tabela `orders` para obter `user_phone`
- Tambem tenta buscar em `web_orders` caso seja pedido web (para obter `customer_phone`)
- Monta a mensagem adequada ao status e tipo de pedido
- Envia via Evolution API para o WhatsApp do cliente
- Registra a mensagem na tabela `messages`

**2. Alteracao no `orderStore.ts`**
- Apos o `updateOrderStatus` executar o UPDATE com sucesso, chama a edge function `notify-order-status` passando o novo status
- A chamada e feita em background (sem bloquear a UI) -- se falhar, o status do pedido ja foi atualizado

**3. Tratamento para pedidos WhatsApp vs Web**
- Pedidos WhatsApp: o telefone esta no campo `user_phone` da tabela `orders`
- Pedidos Web: o telefone esta no campo `customer_phone` da tabela `web_orders`
- A edge function verifica ambas as fontes para garantir o envio

**4. Configuracao no `supabase/config.toml`**
- Adicionar entrada `[functions.notify-order-status]` com `verify_jwt = false`

### Fluxo

```text
Restaurante muda status no Kanban
        |
        v
orderStore.updateOrderStatus()
        |
        +---> UPDATE orders SET status = 'preparing'
        |
        +---> POST notify-order-status (background)
                    |
                    v
              Busca telefone do cliente
                    |
                    v
              Monta mensagem adequada ao status
                    |
                    v
              Envia via Evolution API
                    |
                    v
              Registra em messages
```

### Arquivos a criar/modificar

- **Criar:** `supabase/functions/notify-order-status/index.ts`
- **Modificar:** `src/stores/orderStore.ts` (adicionar chamada apos update)
- **Modificar:** `supabase/config.toml` (adicionar entry da nova funcao)

