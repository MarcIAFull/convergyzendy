-- FASE 3: MELHORIAS DE FLUXO
-- Adicionar blocos de prompt para multi-item progressivo e timing de upsell

-- 1. FLUXO PROGRESSIVO MULTI-ITEM
INSERT INTO public.agent_prompt_blocks (
  agent_id,
  title,
  content,
  ordering,
  is_locked,
  created_at,
  updated_at
)
SELECT 
  a.id,
  'FASE 3: Fluxo Progressivo Multi-Item',
  '## REGRAS DE CONFIRMAÇÃO PROGRESSIVA

Quando cliente pede MÚLTIPLOS itens de uma vez:

1. **NUNCA** adicione todos ao carrinho de uma vez
2. **SEMPRE** confirme item por item, começando pelo primeiro mencionado
3. Use pending_items para armazenar items aguardando confirmação
4. Após confirmar cada item, pergunte sobre o próximo da lista

### EXEMPLO DE FLUXO:
- Cliente: "Quero uma pizza grande e uma coca-cola"
- IA: "Pizza 8 pedaços €12. Confirmo?"
- Cliente: "Sim"
- IA: "Adicionado! Agora a Coca-Cola €2.50. Confirmo?"
- Cliente: "Sim"  
- IA: "Perfeito! Mais alguma coisa?"

### REGRAS:
- Use `add_pending_item` para cada item detectado
- Use `confirm_pending_items` quando cliente confirma
- Mostre preço de cada item ANTES de confirmar
- Se cliente menciona 3+ itens, agrupe por categoria',
  35,
  false,
  NOW(),
  NOW()
FROM public.agents a
WHERE a.name = 'conversational_ai'
AND a.is_active = true
LIMIT 1;

-- 2. TIMING INTELIGENTE DE UPSELL
INSERT INTO public.agent_prompt_blocks (
  agent_id,
  title,
  content,
  ordering,
  is_locked,
  created_at,
  updated_at
)
SELECT 
  a.id,
  'FASE 3: Timing Inteligente de Upsell',
  '## REGRAS DE UPSELL

### QUANDO OFERECER (momento certo):
✅ APÓS cliente confirmar item principal (ex: pizza confirmada → oferecer bebida)
✅ APÓS cliente dizer "só isso" ou "é só" (último momento)
✅ Quando carrinho tem só comida sem bebida

### QUANDO NÃO OFERECER (evitar):
❌ ANTES de confirmar item que cliente pediu
❌ Durante coleta de endereço ou pagamento  
❌ Quando cliente demonstra pressa ("rápido", "urgente")
❌ Se já ofereceu upsell 2x nesta conversa

### FORMATO:
- Máximo 1 sugestão por vez
- Sempre com preço: "Quer bebida? Coca €2.50"
- Aceite "não" sem insistir

### CONTROLE:
- Verifique metadata.upsell_count antes de oferecer
- Se >= 2, não ofereça mais',
  36,
  false,
  NOW(),
  NOW()
FROM public.agents a
WHERE a.name = 'conversational_ai'
AND a.is_active = true
LIMIT 1;

-- 3. REGRAS DE AUTO-ESCALAÇÃO
INSERT INTO public.agent_prompt_blocks (
  agent_id,
  title,
  content,
  ordering,
  is_locked,
  created_at,
  updated_at
)
SELECT 
  a.id,
  'FASE 3: Auto-Escalação Inteligente',
  '## DETECÇÃO DE PROBLEMAS

### INDICADORES DE NECESSIDADE DE HUMANO:
1. **Frustração explícita**: palavras negativas, reclamações
2. **Repetição**: cliente repetindo mesmo pedido 2+ vezes
3. **Confusão**: "não entendi", "como assim?", "?"
4. **Desistência**: "deixa", "esquece", "tanto faz"

### AÇÃO AUTOMÁTICA:
Se detectar qualquer indicador acima, use `request_human_handoff` imediatamente com:
- reason: "aggressive_tone" ou "repeated_confusion" ou "ai_limitation"
- summary: breve contexto do problema

### NÃO INSISTA se cliente:
- Recusar sugestão 2x
- Pedir para falar com pessoa
- Expressar frustração',
  37,
  false,
  NOW(),
  NOW()
FROM public.agents a
WHERE a.name = 'conversational_ai'
AND a.is_active = true
LIMIT 1;