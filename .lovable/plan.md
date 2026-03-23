

## Plano: Corrigir credenciais ZoneSoft e adaptar lógica ao feedback do suporte

### Resumo do feedback ZoneSoft

O suporte confirmou:
1. **ZSROI** (`zsroi.zonesoft.org/v1.0/`) — apenas encomendas e takeaway. Não tem `products/getInstances`.
2. **ZSAPI** — API de sincronização (produtos, documentos). Precisa de **integração separada** com permissão ZSAPI, que **ainda não existe**.
3. O App Secret deve ser usado como **string UTF-8** (não hex-decoded).
4. Headers: `Authorization` + `X-Integration-Signature`.
5. Credenciais novas partilhadas:
   - APP-KEY: `EC23...2E14`
   - APP-SECRET: `1E45...E5F4`
   - Graça (store 1): Client ID `13E5...7571`
   - Barreiro (store 2): Client ID `768D...8D54`

### Problemas atuais na BD

| Restaurante | Campo | Valor atual | Valor correto |
|-------------|-------|-------------|---------------|
| Graça | client_id | `442F...06EE` (antigo) | `13E5...7571` |
| Graça | app_key | `2AB4...6B09` (antigo) | `EC23...2E14` |
| Graça | app_secret | `8DF6...47A2` (antigo) | `1E45...E5F4` |
| Barreiro | client_id | `0C9B...A00C` (errado) | `768D...8D54` |
| Barreiro | app_key | `2AB4...6B09` (antigo) | `EC23...2E14` |
| Barreiro | app_secret | `8DF6...47A2` (antigo) | `1E45...E5F4` |
| Barreiro | api_type | `zsapi` | `zsroi` (ZSAPI não disponível) |

Além disso, o Barreiro tem os dados novos no campo `zsapi_*`, mas esses são credenciais ZSROI, não ZSAPI.

### O que vou implementar

#### 1. Atualizar credenciais na BD (migration)
- Graça: atualizar `client_id`, `app_key`, `app_secret` com as novas credenciais ZSROI
- Barreiro: atualizar `client_id`, `app_key`, `app_secret`, limpar `zsapi_*` (não existem credenciais ZSAPI), corrigir `api_type` para `zsroi`, ativar `enabled`

#### 2. Adaptar `test-connection` no `zonesoft-api/index.ts`
- Para ZSROI: testar apenas endpoints de ordering (`Orders/getInstances`, `Takeaway/getInstances`, `Documents/getInstances`) — remover `products/getInstances` dos testes ZSROI
- Reduzir variantes de header: o suporte confirmou que é `Authorization = Client ID` e `X-Integration-Signature = HMAC`. Priorizar essa combinação (mantendo fallbacks, mas tentando primeiro a confirmada)
- Priorizar assinatura `utf8:hexLower` (string UTF-8 conforme confirmado pelo suporte)

#### 3. Bloquear `sync-products` quando não há ZSAPI
- Se não existem credenciais ZSAPI e `api_type` é `zsroi`, devolver erro claro: "Sincronização de produtos requer credenciais ZSAPI (API de sincronização). Contacte o suporte ZoneSoft para criar uma integração ZSAPI."
- Na UI, desabilitar botão de sync produtos quando não há ZSAPI configurado

#### 4. Corrigir URL ZSAPI
- Mudar `zsapi.zonesoft.org` para placeholder ou remover até ter a URL real (o DNS não resolve)
- Adicionar nota no código que a URL deve ser confirmada via `developer.zonesoft.org`

### Ficheiros a alterar
- **Nova migration SQL**: atualizar credenciais nas duas configs
- **`supabase/functions/zonesoft-api/index.ts`**: adaptar test-connection, bloquear sync-products sem ZSAPI, priorizar variante de auth confirmada
- **`src/components/settings/ZoneSoftTab.tsx`**: desabilitar botão de sync quando não há ZSAPI

### Sem alterações necessárias
- Sem novas secrets
- Sem novas tabelas

### Critérios de sucesso
- `test-connection` no Barreiro e Graça retorna sucesso com as credenciais ZSROI
- `sync-products` devolve mensagem clara quando ZSAPI não está disponível
- Logs sem DNS errors

