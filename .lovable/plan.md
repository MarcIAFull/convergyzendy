
Objetivo

Corrigir o 404 do `search_menu` no MCP Flow e deixar o simulador a testar o fluxo completo sem depender de integrações de produção.

Diagnóstico

- O problema já não parece ser deploy: os logs de `mcp-zendy` mostram `booted`, então a Edge Function existe e arranca.
- O 404 acontece quando o `whatsapp-ai-agent` faz `supabase.functions.invoke('mcp-zendy')`.
- No código atual, `supabase/functions/mcp-zendy/index.ts` usa `new Hono().basePath('/functions/v1/mcp-zendy')`.
- Em Supabase Edge Functions, o runtime já encaminha o request para a raiz da function. Ou seja, o `invoke('mcp-zendy')` chega à function como `POST /`, não como `POST /functions/v1/mcp-zendy`.
- Resultado: a function está online, mas as rotas não casam; o Hono responde `404 Not Found`. Isso bate exatamente com o sintoma “booted + 404”.

O que vou implementar

1. Corrigir o roteamento do `mcp-zendy`
- Remover o `basePath('/functions/v1/mcp-zendy')`.
- Manter as rotas na raiz real da function:
  - `GET /`
  - `GET /health`
  - `POST /`
  - `POST /execute`
  - `ALL /mcp`
- Corrigir também os endpoints devolvidos no JSON de `/`, para não induzirem em erro.

2. Melhorar logs e diagnóstico
- Adicionar logs no `mcp-zendy` com método e path recebidos.
- Adicionar um fallback 404 com log claro para futuras falhas de rota.
- Garantir respostas JSON consistentes.

3. Endurecer o `callMCPTool` no `whatsapp-ai-agent/mcp-flow.ts`
- Melhorar o tratamento de `FunctionsHttpError` para extrair `status`, `statusText` e body da resposta.
- Registar o erro de forma legível nos logs.
- Manter o `simulatorMode` a bypassar o envio por WhatsApp, porque essa parte já está a funcionar.

4. Validar o fluxo do simulador
- Confirmar que o simulador continua a chamar `whatsapp-ai-agent` com `simulatorMode: true`.
- Confirmar que o MCP passa a responder sem tocar na Evolution/WhatsApp.
- Só depois disso avaliar se existe um segundo problema nas tools.

Arquivos a alterar

- `supabase/functions/mcp-zendy/index.ts`
- `supabase/functions/whatsapp-ai-agent/mcp-flow.ts`

Sem alterações necessárias

- Sem mudanças de base de dados.
- Sem novas secrets.
- Sem mudanças obrigatórias na UI do simulador.

Critérios de sucesso

- `supabase.functions.invoke('mcp-zendy', { body: { name: 'test_ping' } })` deixa de devolver 404.
- O simulador recebe resposta da IA com resultado de `search_menu`.
- Os logs deixam de mostrar `FunctionsHttpError ... status: 404 ... /functions/v1/mcp-zendy`.
- Os logs continuam a mostrar o bypass: `Simulator: skipped WhatsApp send`.

Detalhes técnicos

```text
Hoje:
whatsapp-ai-agent
  -> supabase.functions.invoke('mcp-zendy')
  -> request chega à raiz da function
  -> Hono espera /functions/v1/mcp-zendy por causa do basePath
  -> 404

Depois:
whatsapp-ai-agent
  -> supabase.functions.invoke('mcp-zendy')
  -> Hono responde em POST /
  -> executeTool('search_menu')
  -> resultado volta ao MCP Flow
  -> simulador mostra resposta sem enviar WhatsApp
```

Verificação após implementar

1. Teste rápido do `mcp-zendy` com `test_ping`.
2. Teste do simulador com algo como “quero ver os doces”.
3. Conferir logs de:
- `mcp-zendy` para rota recebida e execução da tool
- `whatsapp-ai-agent` para confirmar ausência de 404 e manutenção do bypass
