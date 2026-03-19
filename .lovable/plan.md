

## Plano: Simplificar Modo Recepção — Envio Imediato do Link

### Problema Identificado

No atendimento do telefone 3621, o cliente disse "Queria fazer um pedido de açaí" e a IA entrou em modo de navegação completa: listou 5 opções de açaí com descrições, perguntou complementos, sugeriu itens — tudo isto quando a IA **não anota pedidos**. Só enviou o link do menu digital na 5ª mensagem, quando o intent mudou para `confirm_item`.

**Causa raiz:** O guardrail do Modo Recepção (linhas 831-856 do `index.ts`) só bloqueia intents de ordering (`confirm_item`, `finalize`, etc.), mas `browse_product` e `browse_menu` passam direto para o loop LLM completo. O prompt diz "podes responder dúvidas sobre produtos (search_menu)", o que faz a IA navegar extensivamente pelo menu antes de sugerir o link.

### O Que Vou Implementar

#### 1. Expandir o guardrail de Modo Recepção no `index.ts`

Adicionar uma nova categoria de intents ao guardrail: **intents que demonstram intenção de compra**. Quando o cliente demonstra que quer pedir (não apenas tirar dúvidas), o sistema envia o link imediatamente sem passar pelo LLM.

Intents que disparam envio direto do link (além dos atuais):
- `browse_product` **quando a mensagem indica intenção de compra** (ex: "quero", "queria", "manda", "pedido")
- `confirm_item`, `finalize`, `provide_address`, `provide_payment`, etc. (já existentes)

Intents que continuam a passar pelo LLM (para o agente responder naturalmente):
- `browse_product` / `browse_menu` **sem intenção de compra** (ex: "quanto custa X?", "tem opções sem glúten?")
- `ask_question` (ex: "qual o horário?", "fazem entrega?")
- `greeting`, `acknowledgment`
- `clarify`

**Lógica:** Regex simples no `rawMessage` para detectar intenção de compra: `/quero|queria|manda|pedir|pedido|adiciona|vou querer/i`

#### 2. Simplificar o prompt de Modo Recepção no `conversational-ai-prompt.ts`

Tornar o comportamento do LLM mais direto quando estiver em modo recepção:
- Respostas curtas (1-2 frases máximo)
- Após qualquer browse com resultado, mencionar sempre o link do menu
- Nunca listar mais de 3 produtos (apenas dar uma ideia, o detalhe está no menu digital)
- Sem markdown (sem `**bold**`) — o WhatsApp não renderiza markdown do GPT

#### 3. Atualizar o prompt block no `seed-agent-prompts.sql`

Atualizar a secção `reception_mode_section` para refletir as novas regras.

### Ficheiros a Alterar

- **`supabase/functions/whatsapp-ai-agent/index.ts`** — Expandir guardrail (linhas ~830-856)
- **`supabase/functions/whatsapp-ai-agent/conversational-ai-prompt.ts`** — Simplificar prompt de modo recepção
- **`supabase/seed-agent-prompts.sql`** — Atualizar template do reception_mode_section

### Detalhes Técnicos

```text
ANTES (fluxo atual):
  "Queria pedir açaí" → browse_product → LLM → search_menu → lista 5 itens → sugere → ...
  ... 4 mensagens depois → confirm_item → guardrail → envia link

DEPOIS (fluxo corrigido):
  "Queria pedir açaí" → browse_product → detecta intenção de compra → envia link IMEDIATAMENTE
  "Quanto custa o açaí G?" → browse_product → sem intenção de compra → LLM responde (curto) + menciona link
```

Guardrail expandido (pseudo-código):
```typescript
if (!aiOrderingEnabled) {
  const orderLikeIntents = new Set(['confirm_item', 'finalize', ...]);
  const purchaseIntentRegex = /quero|queria|manda|pedir|pedido|adiciona|vou querer|faz.*pedido/i;
  
  const isBrowseWithPurchaseIntent = 
    ['browse_product', 'browse_menu'].includes(intent) && 
    purchaseIntentRegex.test(rawMessage);

  if (orderLikeIntents.has(intent) || isBrowseWithPurchaseIntent) {
    skipLLM = true;
    finalResponse = `Faz o teu pedido pelo nosso menu digital:\n${context.menuUrl}\n\nÉ rápido e prático! 😊`;
  }
}
```

### Sem Alterações Necessárias
- Sem mudanças de base de dados
- Sem novas secrets
- Sem alterações de UI

### Critérios de Sucesso
- "Queria pedir açaí" em modo recepção → link do menu na 1ª resposta
- "Quanto custa o açaí?" em modo recepção → resposta curta + menção ao link
- "Qual o horário?" → resposta normal sem link forçado
- Respostas sem markdown (`**bold**`) no WhatsApp

