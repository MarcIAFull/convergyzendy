# Plano de Desenvolvimento - Zendy AI

Este documento descreve o status atual do desenvolvimento e o roadmap futuro.

---

## 📊 Status Atual: ~90% Completo

**Última atualização**: 2025-12-02

---

## ✅ Funcionalidades Implementadas

### Core System

| Feature | Status | Descrição |
|---------|--------|-----------|
| Autenticação | ✅ 100% | Login/logout via Supabase Auth |
| Dashboard de Pedidos | ✅ 95% | Kanban em tempo real, drag & drop |
| Gestão de Menu | ✅ 100% | CRUD categorias, produtos, addons |
| Chat/Mensagens | ✅ 90% | Lista conversas, envio/recebimento |
| Analytics | ✅ 95% | Métricas, gráficos, top produtos |
| Customers | ✅ 95% | CRM, insights, histórico |
| Settings | ✅ 100% | Config restaurante, horários |

### AI System

| Feature | Status | Descrição |
|---------|--------|-----------|
| Two-Agent Architecture | ✅ 100% | Orchestrator + Conversational |
| Iterative Function Calling | ✅ 100% | Loop até AI parar de chamar tools |
| 14 Tools | ✅ 100% | search_menu, add_to_cart, finalize, etc. |
| RAG Menu | ✅ 100% | Categorias no prompt, produtos via tool |
| RAG Customer | ✅ 100% | Insights via get_customer_history |
| Prompt Configuration | ✅ 90% | Editor de blocos, variáveis |
| AI Personalization | ✅ 90% | Tom, saudação, upsell |

### WhatsApp Integration

| Feature | Status | Descrição |
|---------|--------|-----------|
| Evolution API | ✅ 100% | Conexão, QR Code, webhooks |
| Message Debouncing | ✅ 100% | Agrupa mensagens rápidas |
| Rate Limiting | ✅ 100% | Proteção contra spam |
| Envio de Mensagens | ✅ 100% | Via whatsapp-send function |
| Real-time Updates | ✅ 100% | Supabase subscriptions |

### Delivery System

| Feature | Status | Descrição |
|---------|--------|-----------|
| Zonas de Entrega | ✅ 100% | Configuração visual no mapa |
| Geocoding | ✅ 100% | Google Maps API |
| Validação de Endereço | ✅ 100% | Verifica zona e taxa |
| Cache de Endereços | ✅ 100% | Evita chamadas repetidas |

### Recovery System

| Feature | Status | Descrição |
|---------|--------|-----------|
| Abandoned Cart | ✅ 100% | Detecta e envia mensagem |
| Paused Conversation | ✅ 100% | Retoma conversas inativas |
| Customer Inactive | ✅ 100% | Reengaja clientes antigos |
| Cooldown | ✅ 100% | 24h entre tentativas |

### Public Menu

| Feature | Status | Descrição |
|---------|--------|-----------|
| Menu Público | ✅ 100% | `/m/:slug` |
| Carrinho Web | ✅ 100% | Adicionar/remover itens |
| Checkout Web | ✅ 90% | Finalização via web |

---

## 🔧 Em Refinamento

### AI Optimization

| Item | Status | Descrição |
|------|--------|-----------|
| Token Usage | 🔧 70% | Otimizar prompts para menor custo |
| Response Time | 🔧 80% | Reduzir latência |
| Prompt Versioning | ❌ 0% | Histórico de versões |
| A/B Testing | ❌ 0% | Testar variações de prompt |

### Monitoring

| Item | Status | Descrição |
|------|--------|-----------|
| AI Logs Dashboard | ✅ 80% | Página /ai-logs |
| Error Alerting | ❌ 0% | Alertas automáticos |
| Performance Metrics | 🔧 50% | Métricas de latência |

### Testing

| Item | Status | Descrição |
|------|--------|-----------|
| Manual Testing | ✅ 100% | Via TestWhatsApp page |
| Unit Tests | ❌ 0% | Jest/Vitest |
| E2E Tests | ❌ 0% | Playwright/Cypress |
| Integration Tests | ❌ 0% | API tests |

---

## 📅 Roadmap

### Fase Atual: Estabilização (Q4 2024)

- [x] Implementar iterative function calling
- [x] Otimizar conversation_history (remover duplicação)
- [x] Fix TestWhatsApp para salvar mensagens inbound
- [ ] Testes end-to-end automatizados
- [ ] Documentação completa
- [ ] Otimização de tokens

### Fase 2: Melhorias UX (Q1 2025)

- [ ] Notificações push/sonoras para novos pedidos
- [ ] Templates de resposta rápida
- [ ] Drag & drop para reordenar menu
- [ ] Preview de prompts em tempo real
- [ ] Indicador "AI digitando"

### Fase 3: Multi-Tenant Avançado (Q1 2025)

- [ ] Múltiplos restaurantes por usuário
- [ ] White-label com domínio customizado
- [ ] Billing com Stripe
- [ ] Planos de assinatura

### Fase 4: CRM & Marketing (Q2 2025)

- [ ] Tags/segmentação de clientes
- [ ] Campanhas de marketing
- [ ] Programa de fidelidade
- [ ] Cupons e promoções

### Fase 5: Integrações (Q2-Q3 2025)

- [ ] Integração PIX
- [ ] Integração iFood/Rappi
- [ ] App mobile (React Native)
- [ ] Impressão de pedidos

---

## 🐛 Bugs Conhecidos

| Bug | Severidade | Status |
|-----|------------|--------|
| AI às vezes repete saudação | Baixa | Mitigado via prompt |
| QR Code expira sem feedback | Baixa | Pendente |
| Menu público não atualiza real-time | Baixa | Pendente |

---

## 📝 Decisões Técnicas Importantes

### 1. Histórico de Conversa no System Prompt (2025-12-02)

**Decisão**: Manter `{{conversation_history}}` APENAS no system prompt, não duplicar no messages array.

**Razão**: Reduz tokens em ~30%, evita contexto duplicado.

### 2. Iterative Function Calling (2025-12-01)

**Decisão**: Implementar loop while com `role: 'tool'` messages.

**Razão**: Padrão OpenAI correto. Sem isso, AI não via resultados das tools.

### 3. Message Debouncing (2025-11)

**Decisão**: Agrupar mensagens em janela de 5 segundos.

**Razão**: Clientes enviam múltiplas mensagens rápidas. Sem debounce, cada uma gerava resposta separada.

### 4. Two-Agent Architecture (2025-10)

**Decisão**: Separar Orchestrator (classifica intent) de Conversational (executa e responde).

**Razão**: Classificação de intent é determinística e rápida. Execução pode ser iterativa e complexa.

### 5. RAG para Menu (2025-10)

**Decisão**: Injetar apenas categorias no prompt, produtos via tool.

**Razão**: Menu grande = 56k+ tokens. Com RAG, ~1k tokens.

---

## 📊 Métricas de Desenvolvimento

### Código

- **Arquivos TypeScript**: ~150
- **Linhas de Código**: ~25,000
- **Edge Functions**: 16
- **Tabelas no Banco**: ~30
- **Componentes React**: ~100

### Performance

- **Tempo médio de resposta AI**: 3-8 segundos
- **Tokens por interação**: ~3,000
- **Latência webhook → resposta**: 5-15 segundos

---

## 🔗 Links Úteis

- **Projeto Lovable**: https://lovable.dev/projects/789c9398-6603-4ec0-a3d4-d716bc0d8031
- **Supabase Dashboard**: https://supabase.com/dashboard/project/tgbfqcbqfdzrtbtlycve
- **Edge Function Logs**: https://supabase.com/dashboard/project/tgbfqcbqfdzrtbtlycve/functions

---

**Última atualização**: 2025-12-02
