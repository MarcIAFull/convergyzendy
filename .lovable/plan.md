

## Diagnóstico

Identifiquei **dois problemas** separados:

### Problema 1: Notificações WhatsApp falhando (404)
As edge functions `notify-web-order` e `notify-customer-order` constroem a URL da Evolution API diretamente com `Deno.env.get('EVOLUTION_API_URL')` sem remover a barra final. O resultado é uma URL malformada: `https://evolution.fullbpo.com//message/sendText/...` (barra dupla), que retorna 404.

O módulo compartilhado `evolutionClient.ts` já faz essa normalização (`apiUrl.replace(/\/+$/, '')`), mas essas duas funções não o utilizam.

**Correção:** Adicionar `.replace(/\/+$/, '')` ao `evolutionApiUrl` em ambas as edge functions.

### Problema 2: Pedidos web não aparecem no quadro
O dashboard (`orderStore.ts`) consulta apenas a tabela `orders`. Pedidos do menu digital vão para a tabela `web_orders`. Não existe integração entre as duas — os pedidos web simplesmente não aparecem no painel.

**Correção:** Modificar o `orderStore` para também buscar `web_orders` e unificá-los na mesma lista, adaptando os campos para o formato `OrderWithDetails`.

---

### Plano de Implementação

**1. Corrigir URL da Evolution API (notify-web-order e notify-customer-order)**
- Adicionar normalização: `const normalizedUrl = evolutionApiUrl.replace(/\/+$/, '');`
- Usar `normalizedUrl` na chamada fetch em ambas as funções
- Redesplegar ambas as funções

**2. Integrar web_orders no dashboard**
- Modificar `orderStore.ts` > `fetchOrders` para também buscar `web_orders` filtrados pelo `restaurant_id`
- Mapear `web_orders` para o formato `OrderWithDetails` (usar `customer_phone` como `user_phone`, montar items a partir do JSONB `items`)
- Concatenar com os pedidos da tabela `orders` e ordenar por `created_at`
- Adicionar subscripção realtime para `web_orders` também

**3. Adaptar tipos**
- Garantir que os pedidos web mapeados incluam um campo `source: 'web'` para diferenciação visual no dashboard

### Arquivos a modificar
- `supabase/functions/notify-web-order/index.ts` — normalizar URL
- `supabase/functions/notify-customer-order/index.ts` — normalizar URL
- `src/stores/orderStore.ts` — buscar e unificar web_orders
- Possivelmente `src/types/database.ts` — ajustar tipo se necessário

