-- Add handoff tracking columns to conversation_mode
ALTER TABLE public.conversation_mode
ADD COLUMN IF NOT EXISTS handoff_reason TEXT,
ADD COLUMN IF NOT EXISTS handoff_summary TEXT;

-- Comment on new columns
COMMENT ON COLUMN public.conversation_mode.handoff_reason IS 'Reason for handoff: customer_request, aggressive_tone, ai_limitation, repeated_confusion';
COMMENT ON COLUMN public.conversation_mode.handoff_summary IS 'AI-generated summary of the situation for the human agent';

-- Insert the new request_human_handoff tool for conversational_ai agent
INSERT INTO public.agent_tools (
  agent_id,
  tool_name,
  enabled,
  ordering,
  description_override,
  usage_rules
)
SELECT 
  id as agent_id,
  'request_human_handoff' as tool_name,
  true as enabled,
  100 as ordering,
  'Transfere a conversa para atendimento humano quando o cliente pedir explicitamente, demonstrar frustração/agressividade, ou quando a IA não conseguir resolver a situação' as description_override,
  'USE quando: 1) Cliente pede explicitamente "quero falar com humano/atendente/gerente". 2) Tom agressivo com palavrões ou insultos. 3) Frustração clara após múltiplas tentativas. 4) IA não consegue entender/resolver após 3+ tentativas. NÃO use para dúvidas simples que podem ser resolvidas.' as usage_rules
FROM public.agents
WHERE name = 'conversational_ai' AND is_active = true
ON CONFLICT (agent_id, tool_name) DO NOTHING;

-- Add needs_human intent to orchestrator prompt
-- First, let's add a new prompt block for the orchestrator with the needs_human intent
INSERT INTO public.agent_prompt_blocks (
  agent_id,
  title,
  content,
  ordering,
  is_locked
)
SELECT 
  id as agent_id,
  'Intent: needs_human (Handoff)' as title,
  '### 11. needs_human
**Prioridade:** ALTA - detectar antes de outros intents
**Sinais Explícitos:**
- "quero falar com humano", "atendente", "gerente", "pessoa de verdade", "alguém real"
- "chama o responsável", "falar com dono", "passar para atendimento"

**Sinais de Frustração/Agressividade:**
- Tom agressivo: palavrões, insultos, "lixo", "péssimo", "incompetentes"
- Frustração: "não funciona", "não entende nada", "que absurdo", "ridículo", "palhaçada"
- Desistência: "desisto", "esquece", "deixa pra lá", "não quero mais", "cansei"
- Ameaças: "vou reclamar", "vou denunciar", "nunca mais"

**Sinais de Confusão Repetida:**
- 3+ mensagens seguidas com intent "unclear" no histórico
- Cliente repete a mesma pergunta várias vezes

**Target State:** manual_requested
**Confidence:** 0.9+ para pedidos explícitos, 0.7+ para sinais indiretos
**Ação:** Handoff imediato para atendente humano' as content,
  15 as ordering,
  false as is_locked
FROM public.agents
WHERE name = 'orchestrator' AND is_active = true
ON CONFLICT DO NOTHING;