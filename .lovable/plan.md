

# Plano: Limpeza Automática de Carrinhos após 24 Horas

## Problema

Carrinhos WhatsApp com status `active` ficam indefinidamente na base de dados. Quando o cliente volta dias depois, o agente IA carrega o carrinho antigo como se fosse atual, causando confusão.

Atualmente existem **10+ carrinhos ativos** com mais de 24 horas no banco.

## Solução

Três alterações complementares:

### 1. Filtrar carrinhos antigos no Context Builder

**Ficheiro:** `supabase/functions/whatsapp-ai-agent/context-builder.ts`

- Na query que carrega o carrinho ativo (linha ~199-211), adicionar filtro temporal:
  - Só carregar carrinhos com `updated_at` nas últimas 24 horas
  - Se o carrinho for mais antigo, tratar como se não existisse (carrinho vazio)
- Isto garante que o agente IA nunca vê carrinhos expirados

### 2. Criar função de limpeza automática no banco

**Nova migration SQL:**

- Criar função `cleanup_expired_carts()` que:
  - Muda status de `active` para `expired` em carrinhos com `updated_at > 24 horas`
  - Também limpa `conversation_pending_items` com mais de 24h
  - Reseta `conversation_state` para `idle` quando o carrinho associado expira
- Agendar via `pg_cron` para rodar a cada hora

### 3. Limpeza do carrinho público (frontend)

**Ficheiro:** `src/stores/publicCartStore.ts`

- Adicionar timestamp de última atualização ao estado persistido
- Na inicialização, verificar se o carrinho tem mais de 24h e limpar automaticamente

---

## Detalhes Técnicos

### Context Builder - Filtro Temporal

```text
Alterar a query de carts (linhas 199-211) para incluir:
  .gt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

Se nenhum carrinho for encontrado, activeCart = null e cartItems = []
Log: "[Context Builder] Cart expired (>24h), treating as empty"
```

### Migration SQL - Cleanup + Cron

```text
1. Criar função cleanup_expired_carts():
   UPDATE carts SET status = 'expired' 
   WHERE status = 'active' AND updated_at < NOW() - INTERVAL '24 hours';
   
   DELETE FROM conversation_pending_items 
   WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours';
   
   UPDATE conversation_state SET state = 'idle', metadata = '{}'
   WHERE cart_id IN (SELECT id FROM carts WHERE status = 'expired' AND updated_at > NOW() - INTERVAL '25 hours');

2. Agendar cron job (via SQL direto, não migration):
   SELECT cron.schedule('cleanup-expired-carts-hourly', '0 * * * *', 
     $$SELECT cleanup_expired_carts()$$);
```

### Public Cart Store - TTL no LocalStorage

```text
Adicionar campo "lastUpdated" ao estado persistido.
No setSlug e addItem, atualizar lastUpdated = Date.now().
Na inicialização, se Date.now() - lastUpdated > 24h, chamar clearCart().
```

## Resultado Esperado

- Carrinhos WhatsApp expiram automaticamente após 24h (backend)
- Context Builder nunca carrega carrinhos com mais de 24h (segurança extra)
- Carrinho público no browser também limpa após 24h
- Dados do cliente (nome, morada, insights) continuam preservados no perfil

