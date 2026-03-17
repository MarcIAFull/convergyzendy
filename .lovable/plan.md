

## Plano: Trazer alterações da branch `feat/mcp` para o projeto

A branch `feat/mcp` contém 2 commits com 15 ficheiros alterados (1610 adições). Trata-se de um **servidor MCP (Model Context Protocol)** que oferece uma alternativa ao fluxo Orchestrator+Conversational AI para o agente WhatsApp.

### Resumo das alterações

**Novos ficheiros (12):**
- `supabase/functions/mcp-zendy/index.ts` — Servidor MCP com Hono + mcp-lite, endpoints `/mcp`, `/execute`, `/health`
- `supabase/functions/mcp-zendy/deno.json` — Config Deno com imports (hono, mcp-lite, zod)
- `supabase/functions/mcp-zendy/tool-executor.ts` — Executor de tools para endpoint HTTP
- `supabase/functions/mcp-zendy/db/mcp-db-client.ts` — Cliente DB self-contained (menu + customer insights)
- `supabase/functions/mcp-zendy/lib/smart-search-v2.ts` — Smart search v2 com paginação
- `supabase/functions/mcp-zendy/tools/index.ts` — Registo central de tools
- `supabase/functions/mcp-zendy/tools/search-menu.ts` — Tool de pesquisa de menu
- `supabase/functions/mcp-zendy/tools/cart-tools.ts` — Tool de carrinho
- `supabase/functions/mcp-zendy/tools/get-customer-history.ts` — Tool de histórico de cliente
- `supabase/functions/mcp-zendy/tools/get-product-addons.ts` — Tool de addons com paginação
- `supabase/functions/mcp-zendy/tools/addon-selection-tools.ts` — Tools de parse/update/clear customizações
- `supabase/functions/whatsapp-ai-agent/mcp-flow.ts` — Fluxo MCP alternativo no agente WhatsApp

**Ficheiros modificados (3):**
- `supabase/config.toml` — Adicionar `[functions.mcp-zendy]` com `verify_jwt = false`
- `supabase/functions/whatsapp-ai-agent/index.ts` — Import `runMCPFlow` + check `MCP_USE_MCP=true` antes do fluxo normal
- `.env` — Adição de `VITE_SUPABASE_URL` duplicada (ignorar, já existe)

### Passos de implementação

1. **Criar toda a estrutura `mcp-zendy`** — 10 ficheiros novos na edge function
2. **Criar `mcp-flow.ts`** no `whatsapp-ai-agent`
3. **Modificar `whatsapp-ai-agent/index.ts`** — adicionar import do `mcp-flow.ts` e bloco condicional `MCP_USE_MCP`
4. **Atualizar `supabase/config.toml`** — adicionar entry `[functions.mcp-zendy]`

### Nota importante
O fluxo MCP é ativado apenas quando a variável de ambiente `MCP_USE_MCP=true` está definida nos secrets do Supabase. Sem essa variável, o fluxo atual continua a funcionar normalmente — zero impacto.

