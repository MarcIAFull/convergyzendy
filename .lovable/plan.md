

## Plano: Endereço Clicável nas Mensagens WhatsApp

### Problema
As mensagens de confirmação de pedido enviadas via WhatsApp mostram o endereço como texto simples. O motoboy precisa copiar manualmente o endereço e colar no Google Maps.

### Solução
A tabela `web_orders` já armazena `delivery_lat` e `delivery_lng`. Basta gerar um link Google Maps com essas coordenadas e incluí-lo na mensagem. No WhatsApp, links são automaticamente clicáveis.

### Formato do Link
```
https://www.google.com/maps/search/?api=1&query={lat},{lng}
```
Este formato abre diretamente no app Google Maps (Android/iOS) ou no navegador.

### Ficheiros a Alterar

| Ficheiro | Alteração |
|---|---|
| `supabase/functions/notify-web-order/index.ts` | Adicionar link Maps ao bloco `locationInfo` para delivery |
| `supabase/functions/notify-customer-order/index.ts` | Adicionar link Maps ao bloco `locationInfo` para delivery |

### Lógica

Nos dois ficheiros, quando `orderType === 'delivery'`, verificar se `order.delivery_lat` e `order.delivery_lng` existem. Se sim, adicionar o link:

```
📍 *Endereço:*
Rua X, 123, Lisboa
📌 https://www.google.com/maps/search/?api=1&query=38.7223,-9.1393
```

Se não houver coordenadas (fallback), manter apenas o texto do endereço como está hoje.

### Impacto
- Zero risco — apenas adiciona uma linha extra à mensagem
- Não altera nenhuma tabela, apenas leitura de campos já existentes
- Funciona em qualquer app de navegação (Google Maps, Waze, Apple Maps)

