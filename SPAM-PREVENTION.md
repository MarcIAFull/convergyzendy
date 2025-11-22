# Sistema de Prevenção de Spam - Recuperação de Conversas

## Visão Geral

Sistema completo de prevenção de spam e boas práticas implementado no módulo de recuperação automática de conversas abandonadas.

---

## Regras Implementadas

### 1. **Cooldown Global (24h)**

**Objetivo**: Evitar bombardear o mesmo cliente com múltiplas mensagens de recuperação.

**Regra**: Máximo **1 mensagem de recuperação por cliente a cada 24 horas**.

**Implementação**:
- Antes de criar qualquer tentativa de recuperação, o sistema verifica se o cliente recebeu alguma mensagem de recuperação nas últimas 24h
- Se sim, a detecção é ignorada e não cria novo registro
- Aplicado a todos os tipos: carrinho abandonado, conversa pausada e cliente inativo

**Código**: Função `checkCooldown()` em `conversation-recovery/index.ts`

```typescript
const COOLDOWN_HOURS = 24;

// Verifica se cliente tem mensagem enviada nas últimas 24h
const cooldownThreshold = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
```

---

### 2. **Intervalo Mínimo Entre Tentativas**

**Objetivo**: Respeitar um tempo adequado entre cada tentativa de reconexão.

**Regras**:
- **Tentativa 1 → 2**: Aguardar **1 hora** (60 minutos)
- **Tentativa 2 → 3**: Aguardar **12 horas** (720 minutos)

**Implementação**:
- Após enviar uma mensagem (attempt 1), o sistema calcula e armazena `next_attempt_at`
- A cada execução (15min), processa tentativas com `next_attempt_at <= now()`
- Cria automaticamente a próxima tentativa respeitando o intervalo

**Código**: Função `calculateNextAttemptTime()` em `conversation-recovery/index.ts`

```typescript
const ATTEMPT_INTERVALS = {
  1: 60,   // 1 hour after attempt 1
  2: 720,  // 12 hours after attempt 2
};
```

---

### 3. **Máximo 3 Tentativas**

**Objetivo**: Não insistir indefinidamente com clientes que não respondem.

**Regra**: Cada conversa abandonada recebe **no máximo 3 tentativas de recuperação**.

**Implementação**:
- Campo `max_attempts` configurável na UI (mas limitado a 3 no backend)
- Campo `attempt_number` incrementa a cada nova tentativa
- Sistema para de criar tentativas quando `attempt_number >= max_attempts`

**Timeline Típica**:
```
Abandono detectado → Attempt 1 (imediato)
         ↓
    Aguarda 1h
         ↓
Attempt 2 (se não respondeu)
         ↓
    Aguarda 12h
         ↓
Attempt 3 (última tentativa)
         ↓
    Stop (não envia mais)
```

---

### 4. **Opt-Out Automático**

**Objetivo**: Respeitar imediatamente quando o cliente não quer mais receber mensagens.

**Regra**: Se cliente responder com palavras-chave negativas, **marcar todas tentativas como expired**.

**Palavras-chave detectadas**:
- "não quero" / "nao quero"
- "deixa quieto"
- "para de enviar" / "para"
- "stop"
- "cancelar"
- "não me mande" / "nao me mande"
- "não envie" / "nao envie"
- "desinscrever"
- "remover"
- "sair"
- "chega"
- "basta"

**Implementação**:
- Função `checkOptOut()` no `whatsapp-webhook/index.ts`
- Executada logo após salvar mensagem inbound
- Marca todas tentativas (pending + sent) como `status = 'expired'`
- Salva mensagem de opt-out no metadata para auditoria

**Fluxo**:
```
Cliente envia "não quero" 
    ↓
Webhook detecta keyword
    ↓
Marca tentativas como expired
    ↓
Sistema para de enviar mensagens
```

---

### 5. **Horário Comercial**

**Objetivo**: Não incomodar clientes fora do horário de atendimento.

**Regra**: Mensagens só são enviadas entre **9h e 22h**.

**Implementação**:
- Verificação no início da função `sendPendingRecoveryMessages()`
- Se fora do horário, skip do envio (tentativas permanecem pendentes)
- Serão enviadas na próxima execução dentro do horário

```typescript
const hour = now.getHours();
if (hour < 9 || hour >= 22) {
  console.log('[Recovery] Outside business hours, skipping send');
  return;
}
```

---

### 6. **Detecção de Atividade Recente**

**Objetivo**: Não enviar mensagem de recuperação se cliente já voltou a interagir.

**Regra**: Verifica se há mensagens (inbound/outbound) nos **últimos 30 minutos**.

**Implementação**:
- Antes de enviar, busca mensagens recentes do cliente
- Se encontrar, marca tentativa como `recovered` automaticamente
- Evita enviar mensagem desnecessária

```typescript
// Check if customer has recent activity
const recentMessages = await supabase
  .from('messages')
  .gte('timestamp', new Date(Date.now() - 30 * 60 * 1000).toISOString())
  .limit(1);

if (recentMessages.length > 0) {
  // Mark as recovered, don't send
}
```

---

## Status das Tentativas

| Status | Descrição |
|--------|-----------|
| `pending` | Aguardando envio (dentro do horário comercial) |
| `sent` | Mensagem enviada com sucesso |
| `recovered` | Cliente respondeu/voltou a interagir |
| `expired` | Cliente fez opt-out |
| `failed` | Erro no envio (problema técnico) |
| `skipped_cooldown` | Não enviada devido ao cooldown de 24h |

---

## Fluxograma Completo

```
┌─────────────────────────────┐
│  Abandono Detectado         │
│  (cart, conversa, inativo)  │
└──────────┬──────────────────┘
           │
           ▼
    ┌──────────────┐
    │ Cooldown 24h?│◄─── Verifica última mensagem de recovery
    └──────┬───────┘
           │ Não
           ▼
    ┌──────────────┐
    │ Criar Attempt│
    │ number: 1    │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Horário OK?  │
    └──────┬───────┘
           │ Sim
           ▼
    ┌──────────────┐
    │ Atividade    │
    │ recente?     │
    └──────┬───────┘
           │ Não
           ▼
    ┌──────────────┐
    │ ENVIAR       │
    │ Mensagem     │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Agendar      │
    │ próxima      │
    │ (1h ou 12h)  │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Cliente      │◄─── Opt-out? → Marcar EXPIRED
    │ respondeu?   │
    └──────┬───────┘
           │ Não
           ▼
    ┌──────────────┐
    │ Attempt 2    │
    │ (após 1h)    │
    └──────┬───────┘
           │
           ▼
         [...]
           │
           ▼
    ┌──────────────┐
    │ Attempt 3    │
    │ (após 12h)   │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │  FIM         │
    │ (max attempts)│
    └──────────────┘
```

---

## Configuração via UI

Os seguintes parâmetros são configuráveis na página **AI Configuration**:

### Por Tipo de Recovery:

**1. Carrinho Abandonado**
- ✅ Habilitado/Desabilitado
- ⏱️ Delay inicial (padrão: 30min)
- 🔄 Máx tentativas (padrão: 2, limite: 3)
- 💬 Template da mensagem

**2. Conversa Pausada**
- ✅ Habilitado/Desabilitado
- ⏱️ Delay inicial (padrão: 15min)
- 🔄 Máx tentativas (padrão: 1, limite: 3)
- 💬 Template da mensagem

**3. Cliente Inativo**
- ✅ Habilitado/Desabilitado
- ⏱️ Delay inicial (padrão: 30 dias)
- 🔄 Máx tentativas (padrão: 1, limite: 3)
- 💬 Template da mensagem

---

## Logs e Monitoramento

### Logs Importantes:

```
[Recovery] Customer {phone} is in cooldown period
[Recovery] Skipping {type} for {phone} due to cooldown
[Recovery] Next attempt scheduled for: {timestamp}
[OptOut] Customer {phone} requested opt-out with message: "{msg}"
[Recovery] ✅ Sent recovery message (attempt {n}) to {phone}
```

### Métricas Recomendadas:

1. **Taxa de opt-out**: `COUNT(status='expired') / COUNT(total)`
2. **Taxa de recuperação**: `COUNT(status='recovered') / COUNT(total)`
3. **Taxa de resposta por attempt**: Attempt 1 vs 2 vs 3
4. **Tempo médio até recuperação**: `AVG(recovered_at - sent_at)`

---

## Conformidade & Boas Práticas

✅ **GDPR/LGPD Compliance**:
- Opt-out imediato respeitado
- Mensagens salvas para auditoria
- Cooldown previne spam

✅ **WhatsApp Business Policies**:
- Máximo 3 tentativas (WhatsApp permite até 24h)
- Horário comercial respeitado
- Mensagens contextuais (não genéricas)

✅ **User Experience**:
- Mensagens personalizadas com variáveis
- Timing inteligente (1h → 12h)
- Detecção de atividade recente

---

## Testando o Sistema

### 1. Testar Cooldown:
```sql
-- Verificar cooldown de um cliente
SELECT * FROM conversation_recovery_attempts 
WHERE user_phone = '+351912345678'
  AND sent_at > NOW() - INTERVAL '24 hours'
ORDER BY sent_at DESC;
```

### 2. Testar Opt-Out:
- Enviar mensagem com "não quero"
- Verificar se status mudou para `expired`

### 3. Forçar Próxima Tentativa (dev only):
```sql
-- Forçar attempt 2 imediatamente
UPDATE conversation_recovery_attempts
SET next_attempt_at = NOW() - INTERVAL '1 minute'
WHERE id = 'attempt-id-here' AND status = 'sent';
```

---

## Arquivos Modificados

1. **`supabase/functions/conversation-recovery/index.ts`**
   - `checkCooldown()` - Validação de cooldown global
   - `calculateNextAttemptTime()` - Intervalos entre tentativas
   - `processNextAttempts()` - Processamento de attempts 2 e 3

2. **`supabase/functions/whatsapp-webhook/index.ts`**
   - `checkOptOut()` - Detecção de palavras-chave negativas

3. **Database**:
   - Campo `next_attempt_at` adicionado
   - Índice para queries de próximas tentativas

---

## Próximos Passos Recomendados

1. **Dashboard**: Adicionar métricas de recuperação no dashboard
2. **A/B Testing**: Testar diferentes templates e timings
3. **ML**: Prever melhor horário de envio baseado em histórico
4. **Segmentação**: VIP customers com timing diferenciado

---

**Implementado em**: 2025-01-22  
**Versão**: 1.0  
**Status**: ✅ Pronto para produção
