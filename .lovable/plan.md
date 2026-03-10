

## Plano: Atualizar Integração ZoneSoft com Base no Feedback do Suporte

### Situação Atual

A integração já tem a infraestrutura para credenciais ZSAPI separadas:
- DB: colunas `zsapi_client_id`, `zsapi_app_key`, `zsapi_app_secret`, `api_type` existem
- Edge function: já usa credenciais ZSAPI separadas quando disponíveis
- **Problema**: O formulário de configurações (`ZoneSoftTab.tsx`) NÃO expõe os campos ZSAPI — só mostra as credenciais primárias (ZSROI)

### O que o suporte confirmou

1. As credenciais atuais têm permissão **ZS Restaurant Ordering** — apenas para pedidos/takeaway
2. Para sincronização de produtos e documentos, é preciso criar **outra integração** com permissão **ZSAPI**
3. Endpoint correto: `zsroi.zonesoft.org/v1.0/` (ZSROI) — já está no código
4. Headers corretos: `Authorization` e `X-Integration-Signature` — já estão no código

### Alterações Necessárias

**1. `src/components/settings/ZoneSoftTab.tsx`**
- Adicionar secção "Credenciais ZSAPI (Sincronização)" com campos para `zsapi_client_id`, `zsapi_app_key`, `zsapi_app_secret`
- Adicionar selector de `api_type` (`zsroi` / `zsapi` / `both`)
- Adicionar nota explicativa sobre as duas integrações separadas e link para `developer.zonesoft.org`
- Atualizar `formData` type, `handleSave`, e o `useEffect` de hydration

**2. `src/stores/zonesoftStore.ts`** — Sem alterações (já passa config completo ao edge function)

**3. `src/types/zonesoft.ts`** — Adicionar `zsapi_client_id`, `zsapi_app_key`, `zsapi_app_secret`, `api_type` à interface `ZoneSoftConfig`

**4. Edge function** — Já funciona. Sem alterações necessárias.

### Impacto
- Apenas UI de configurações — zero risco para funcionalidades existentes
- Quando o utilizador criar a nova integração ZSAPI no portal ZoneSoft e preencher os campos, a sincronização passará a funcionar

