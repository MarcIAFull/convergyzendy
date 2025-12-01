-- Atualizar o prompt do Orchestrator para incluir {{user_message}} e contexto
UPDATE agent_prompt_blocks
SET content = content || E'\n\n# SEÇÃO 4: MENSAGEM A CLASSIFICAR

A mensagem do cliente para classificar é:
"""
{{user_message}}
"""

Contexto atual da conversa:
- Estado: {{current_state}}
- Carrinho: {{cart_summary}}
- Itens pendentes: {{pending_items}}
- Histórico recente: {{conversation_history}}

Analise a mensagem acima e retorne o JSON de classificação.',
    updated_at = NOW()
WHERE agent_id = (SELECT id FROM agents WHERE type = 'orchestrator' LIMIT 1)
  AND ordering = 0;