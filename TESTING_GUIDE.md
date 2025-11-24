# Testing Guide - Zendy AI Delivery System

Este guia fornece instruções detalhadas para testar todos os componentes críticos do sistema antes de colocar em produção.

## Índice
1. [WhatsApp Integration End-to-End](#1-whatsapp-integration-end-to-end)
2. [Sistema de Recovery](#2-sistema-de-recovery)
3. [Error Handling](#3-error-handling)
4. [Rate Limiting](#4-rate-limiting)
5. [Notificações](#5-notificações)

---

## 1. WhatsApp Integration End-to-End

### Objetivo
Validar que todo o fluxo de comunicação WhatsApp está funcionando corretamente.

### Pré-requisitos
- Restaurante criado no sistema
- Evolution API configurado e rodando
- Credenciais Evolution API configuradas (EVOLUTION_API_URL, EVOLUTION_API_KEY)

### Passo a Passo

#### 1.1. Conectar WhatsApp Instance

1. **Acessar página de WhatsApp Connection**
   - URL: `/whatsapp-connection`
   - Verificar que a página carrega sem erros

2. **Criar/Conectar Instance**
   - Clicar em "Connect WhatsApp"
   - Aguardar geração do QR Code (deve aparecer em ~5 segundos)
   - Status deve mudar para "waiting_qr"

3. **Escanear QR Code**
   - Abrir WhatsApp no celular
   - Dispositivos Conectados > Conectar Dispositivo
   - Escanear o QR Code exibido
   - Aguardar até status mudar para "connected"
   - Verificar que o número do telefone aparece na interface

**Logs a verificar:**
```bash
# Supabase Edge Functions Logs - evolution-connect
[Evolution] Creating/connecting instance
[Evolution] Instance created successfully
[Evolution] QR Code generated

# Supabase Edge Functions Logs - evolution-status
[Evolution] Status: connected
[Evolution] Phone: +55xxxxx
```

#### 1.2. Enviar Mensagem de Teste

1. **Enviar teste do Dashboard**
   - Na página WhatsApp Connection, seção "Send Test Message"
   - Número: seu número de WhatsApp (com código do país)
   - Mensagem: "Teste de conexão"
   - Clicar "Send Test"
   - Verificar mensagem recebida no WhatsApp

**Logs a verificar:**
```bash
# Supabase Edge Functions Logs - whatsapp-send
[WhatsAppSend] Sending to: +55xxxxx
[WhatsAppSend] Message sent successfully
```

#### 1.3. Receber Mensagem e Resposta AI

1. **Enviar mensagem do WhatsApp**
   - Do seu celular, enviar: "Oi"
   - Aguardar resposta do AI (3-5 segundos)

2. **Verificar fluxo completo**
   - Mensagem deve aparecer na página Messages
   - AI deve responder com saudação
   - Estado da conversa deve ser criado

**Logs a verificar:**
```bash
# Supabase Edge Functions Logs - whatsapp-webhook
[EvolutionWebhook] Incoming message from +55xxxxx
[EvolutionWebhook] Message saved to database
[EvolutionWebhook] Calling whatsapp-ai-agent

# Supabase Edge Functions Logs - whatsapp-ai-agent
[WhatsApp AI] NEW MESSAGE RECEIVED
[Orchestrator] Intent: greeting
[Main AI] Generating response
[WhatsApp AI] Reply sent
```

#### 1.4. Fluxo Completo de Pedido

1. **Solicitar menu**
   - Enviar: "Quero ver o cardápio"
   - Verificar que AI envia produtos disponíveis

2. **Adicionar item ao carrinho**
   - Enviar: "Quero 1 pizza margherita"
   - Verificar confirmação de adição

3. **Verificar carrinho**
   - Enviar: "Quanto tá dando?"
   - Verificar que AI mostra subtotal + taxa de entrega

4. **Finalizar pedido**
   - Enviar: "Quero finalizar"
   - Fornecer endereço quando solicitado
   - Escolher forma de pagamento
   - Confirmar pedido

5. **Validar ordem criada**
   - Verificar que ordem aparece no Dashboard
   - Status deve ser "new"
   - Todos os itens devem estar corretos

**Logs a verificar:**
```bash
# Durante todo o fluxo
[Orchestrator] Intent: browse_menu / add_to_cart / checkout / etc.
[Main AI] Tool called: show_product_details / add_to_cart / create_order
[WhatsApp AI] State transition: idle -> browsing -> cart_review -> checkout
```

#### 1.5. Reconexão Automática

1. **Desconectar WhatsApp**
   - No celular, desconectar dispositivo
   - Aguardar 2-3 minutos

2. **Verificar detecção de desconexão**
   - Status na página deve mudar para "disconnected"

3. **Reconectar**
   - Clicar em "Connect WhatsApp" novamente
   - Escanear novo QR Code
   - Verificar reconexão bem-sucedida

---

## 2. Sistema de Recovery

### Objetivo
Validar que mensagens de recuperação são enviadas corretamente.

### Pré-requisitos
- WhatsApp conectado
- Agent de recuperação ativado (verificar em AI Configuration)

### Passo a Passo

#### 2.1. Abandoned Cart Recovery

1. **Criar carrinho abandonado**
   - Iniciar pedido via WhatsApp
   - Adicionar 2-3 itens ao carrinho
   - **NÃO finalizar** - apenas parar de responder

2. **Aguardar mensagem de recovery**
   - Tempo de espera: 30 minutos (configurável)
   - Verificar recebimento de mensagem de recuperação
   - Mensagem deve mencionar itens no carrinho

3. **Verificar banco de dados**
   ```sql
   SELECT * FROM conversation_recovery_attempts 
   WHERE user_phone = '+55xxxxx' 
   AND recovery_type = 'cart_abandoned'
   ORDER BY created_at DESC;
   ```

**Logs a verificar:**
```bash
# Supabase Edge Functions Logs - conversation-recovery
[Recovery] Detecting abandoned carts
[Recovery] Found X abandoned carts
[Recovery] ✅ Sent recovery message (attempt 1) to +55xxxxx
```

#### 2.2. Conversation Paused Recovery

1. **Pausar conversa**
   - Iniciar conversa
   - Enviar 1-2 mensagens
   - Parar de responder no meio da conversa

2. **Aguardar mensagem**
   - Tempo de espera: 15 minutos (configurável)
   - Verificar mensagem: "Olá! 👋 Ficou alguma dúvida?"

#### 2.3. Customer Inactive Recovery

1. **Simular cliente inativo** (apenas em desenvolvimento)
   - Modificar data do último pedido no banco:
   ```sql
   UPDATE orders 
   SET created_at = NOW() - INTERVAL '35 days'
   WHERE user_phone = '+55xxxxx';
   ```

2. **Executar função de recovery**
   - Chamar edge function manualmente
   - Verificar mensagem de "sentimos sua falta"

#### 2.4. Opt-Out

1. **Enviar palavra de opt-out**
   - Após receber mensagem de recovery
   - Responder: "não quero" ou "stop" ou "para"

2. **Verificar cancelamento**
   - Não deve receber mais mensagens de recovery
   - Status no banco deve ser "expired"

---

## 3. Error Handling

### Objetivo
Validar que erros são tratados graciosamente e não quebram o sistema.

### Cenários de Teste

#### 3.1. WhatsApp Desconectado

1. **Desconectar WhatsApp** (celular)
2. **Tentar enviar mensagem** (do dashboard)
3. **Verificar erro amigável**
   - Deve mostrar mensagem: "WhatsApp não conectado"
   - Não deve travar a interface

#### 3.2. OpenAI API Error

1. **Configurar API Key inválido** (temporariamente)
   - Supabase > Edge Functions > Secrets
   - Modificar OPENAI_API_KEY
2. **Enviar mensagem via WhatsApp**
3. **Verificar fallback**
   - Sistema deve logar erro
   - Cliente deve receber mensagem padrão
   - Não deve travar o webhook

**Mensagem de fallback esperada:**
```
Desculpe, estou com dificuldades técnicas no momento. 
Por favor, tente novamente em alguns minutos.
```

#### 3.3. Database Connection Error

1. **Pausar database** (apenas em dev/staging)
2. **Tentar carregar dashboard**
3. **Verificar erro tratado**
   - Página deve mostrar erro amigável
   - Não deve travar completamente

---

## 4. Rate Limiting

### Objetivo
Validar que rate limiting protege contra spam.

### Cenários de Teste

#### 4.1. Spam de Mensagens

1. **Enviar 60+ mensagens rapidamente**
   - Do mesmo número de WhatsApp
   - Intervalo: < 1 segundo entre mensagens

2. **Verificar bloqueio**
   - Após 60 mensagens/minuto, deve receber:
   ```
   Você está enviando mensagens muito rápido. 
   Aguarde alguns momentos e tente novamente.
   ```

**Logs esperados:**
```bash
[RateLimit] Limit exceeded for webhook:+55xxxxx
[RateLimit] Remaining: 0, Reset at: 2024-XX-XX
```

#### 4.2. Múltiplas Conexões

1. **Tentar conectar 10+ vezes**
   - Clicar em "Connect WhatsApp" repetidamente
   - Intervalo: < 10 segundos

2. **Verificar bloqueio**
   - Deve ser bloqueado após 10 tentativas/hora
   - Mensagem: "Muitas tentativas de conexão. Aguarde 1 hora."

---

## 5. Notificações

### Objetivo
Validar sistema de notificações de novos pedidos.

### Pré-requisitos
- Browser com permissões de notificação habilitadas
- Som do sistema ativado

### Cenários de Teste

#### 5.1. Notificação de Novo Pedido

1. **Estar logado no dashboard**
2. **Criar pedido via WhatsApp** (de outro dispositivo)
3. **Verificar notificações:**
   - Som de alerta deve tocar
   - Toast notification deve aparecer
   - Badge de contador deve incrementar
   - Browser notification (se permitido)

#### 5.2. Toggle de Som

1. **Acessar Settings**
2. **Desativar som**
   - Toggle "Enable Sound Notifications"
   - Salvar
3. **Criar novo pedido**
   - Toast deve aparecer
   - Som NÃO deve tocar

#### 5.3. Múltiplos Pedidos

1. **Criar 3 pedidos rapidamente**
2. **Verificar:**
   - Badge mostra "3"
   - Som toca para cada um
   - Ao abrir página Orders, badge zera

---

## Checklist de Validação Final

Antes de colocar em produção, garantir que:

### WhatsApp Integration
- [ ] QR Code gerado corretamente
- [ ] Conexão estabelecida
- [ ] Mensagens enviadas e recebidas
- [ ] AI responde em < 5 segundos
- [ ] Fluxo completo de pedido funciona
- [ ] Reconexão automática funciona

### Recovery System
- [ ] Cart abandoned detectado e mensagem enviada
- [ ] Conversation paused detectado
- [ ] Opt-out funciona
- [ ] Cooldown de 24h respeitado

### Error Handling
- [ ] Erros de conexão tratados
- [ ] Erros de API com fallback
- [ ] Logs detalhados disponíveis
- [ ] Interface não trava em caso de erro

### Rate Limiting
- [ ] Spam de mensagens bloqueado
- [ ] Limite de conexões funciona
- [ ] Logs de rate limit disponíveis

### Notificações
- [ ] Som de novo pedido funciona
- [ ] Toast notifications aparecem
- [ ] Toggle de som funciona
- [ ] Browser notifications (opcional)

### Logs e Monitoring
- [ ] Logs detalhados em todas as funções
- [ ] Erros logados com stack trace
- [ ] Timestamps em todas as operações
- [ ] Fácil de debugar via Supabase logs

---

## Troubleshooting Comum

### WhatsApp não conecta
1. Verificar EVOLUTION_API_URL (sem barra no final)
2. Verificar EVOLUTION_API_KEY válido
3. Verificar logs do Evolution API
4. Tentar recriar instance (deletar e conectar novamente)

### AI não responde
1. Verificar OPENAI_API_KEY válido
2. Verificar logs do edge function whatsapp-ai-agent
3. Verificar se restaurant está marcado como is_open=true
4. Verificar se existem produtos disponíveis no menu

### Recovery não envia
1. Verificar agent recovery_config.enabled = true
2. Verificar tempos de delay configurados
3. Verificar que não há cooldown ativo
4. Executar função manualmente para testar

### Notificações não tocam
1. Verificar permissões do browser
2. Verificar que som está ativado nas settings
3. Verificar que user_id está correto
4. Verificar logs do realtime subscription

---

## Próximos Passos Após Validação

Uma vez que todos os testes passarem:

1. **Documentar issues encontradas** - Criar tickets para problemas menores
2. **Performance test** - Testar com carga (10+ pedidos simultâneos)
3. **Security review** - Revisar RLS policies e permissões
4. **Backup strategy** - Configurar backups automáticos
5. **Monitoring setup** - Integrar Sentry ou ferramenta similar
6. **Deploy to production** - Seguir guia de deploy

**Boa sorte com os testes!** 🚀
