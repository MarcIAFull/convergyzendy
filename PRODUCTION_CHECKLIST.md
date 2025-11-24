# Production Readiness Checklist

Este documento contém todos os itens que devem ser verificados antes de colocar o sistema em produção.

## 📋 Status Geral

- [ ] **Fase Crítica Completa** - Todos os itens marcados abaixo
- [ ] **Testes End-to-End Executados** - Ver [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- [ ] **Documentação Atualizada** - README e guides completos
- [ ] **Backup Strategy Configurada** - Backups automáticos ativos
- [ ] **Monitoring Configurado** - Logs e alertas funcionando

---

## 🔒 Segurança

### Autenticação e Autorização
- [ ] RLS policies ativas em todas as tabelas sensíveis
- [ ] Leaked Password Protection ativado (Supabase Auth)
- [ ] JWT tokens com tempo de expiração adequado
- [ ] Secrets configurados via Supabase (não hardcoded)
- [ ] API keys rotacionados e seguros

### Proteção de Dados
- [ ] Dados de clientes criptografados em repouso
- [ ] Comunicações HTTPS enforced
- [ ] Validação de input em todos os edge functions
- [ ] Sanitização de mensagens antes de enviar ao AI
- [ ] Opt-out de clientes respeitado

### Rate Limiting
- [ ] Rate limiting ativo no webhook (60 msg/min/cliente)
- [ ] Rate limiting no AI Agent (30 req/min/cliente)
- [ ] Rate limiting em envios (120 msg/min/restaurante)
- [ ] Proteção contra múltiplas conexões (10/hora/restaurante)

---

## 🚀 WhatsApp Integration

### Conexão
- [ ] Evolution API rodando e acessível
- [ ] EVOLUTION_API_URL configurado corretamente (sem / no final)
- [ ] EVOLUTION_API_KEY válido e testado
- [ ] QR Code geração funcionando
- [ ] Reconexão automática testada
- [ ] Status check funcionando

### Mensageria
- [ ] Webhook recebendo mensagens
- [ ] Webhook com retry logic para falhas
- [ ] Rate limiting em webhooks ativo
- [ ] Opt-out keywords detectados
- [ ] Mensagens outbound enviadas via Evolution API
- [ ] Logs detalhados de todas as interações

### Fluxo Completo
- [ ] Cliente pode ver menu
- [ ] Cliente pode adicionar itens ao carrinho
- [ ] Cliente pode revisar carrinho
- [ ] Cliente pode finalizar pedido
- [ ] Pedido criado no banco de dados
- [ ] Notificação de novo pedido funcionando

---

## 🤖 AI Agent

### Configuração
- [ ] OPENAI_API_KEY válido e com créditos
- [ ] Agents configurados no banco (orchestrator + conversational)
- [ ] Prompt blocks atualizados
- [ ] Tools habilitados e testados
- [ ] Restaurant AI settings configurados

### Comportamento
- [ ] Respostas em < 5 segundos (95% dos casos)
- [ ] Tom de voz adequado ao restaurante
- [ ] Upselling configurado
- [ ] Saudação e despedida personalizadas
- [ ] Tratamento de erros gracioso

### Fallbacks
- [ ] Mensagem de erro amigável para falhas do AI
- [ ] Fallback para prompts hard-coded se DB falhar
- [ ] Retry logic para chamadas OpenAI
- [ ] Timeout adequado (30s max)

---

## 💾 Banco de Dados

### Performance
- [ ] Índices criados em colunas de busca frequente
- [ ] Queries otimizadas (explain analyze executado)
- [ ] Conexões pooling configurado
- [ ] Cache de queries frequentes (se aplicável)

### Backups
- [ ] Point-in-time recovery ativado no Supabase
- [ ] Backup automático diário configurado
- [ ] Teste de restore executado
- [ ] Backup de secrets e configurações documentado

### Migrations
- [ ] Todas as migrations aplicadas
- [ ] Rollback plan documentado
- [ ] Schema versionado e documentado

---

## 🔄 Recovery System

### Configuração
- [ ] Recovery config ativado no agent
- [ ] Delays configurados adequadamente:
  - [ ] Cart abandoned: 30 minutos
  - [ ] Conversation paused: 15 minutos
  - [ ] Customer inactive: 30 dias
- [ ] Max attempts configurado (1-3)
- [ ] Message templates personalizados

### Funcionamento
- [ ] Abandoned carts detectados
- [ ] Mensagens enviadas corretamente
- [ ] Opt-out funcionando
- [ ] Cooldown de 24h respeitado
- [ ] Next attempts agendados corretamente
- [ ] Recovery messages apenas em horário comercial (9h-22h)

### Spam Prevention
- [ ] Cooldown global de 24h por cliente
- [ ] Max 3 tentativas por recovery
- [ ] Opt-out keywords implementados
- [ ] Checagem de atividade recente antes de enviar

---

## 🔔 Notificações

### Novos Pedidos
- [ ] Notificação visual (toast) funcionando
- [ ] Som de alerta configurável
- [ ] Badge counter incrementando
- [ ] Browser notifications (se permitido)
- [ ] Notificações marcadas como lidas

### Novas Mensagens
- [ ] Notificação de mensagens inbound
- [ ] Som diferente para mensagens (opcional)
- [ ] Counter separado de pedidos

### Settings
- [ ] Toggle de som nas settings
- [ ] Preferências salvas no banco
- [ ] Carregamento de preferências ao login
- [ ] Opção de desativar por tipo (pedidos/mensagens)

---

## 📊 Monitoring e Logs

### Logging
- [ ] Logs estruturados em todos os edge functions
- [ ] Níveis de log adequados (info, warn, error)
- [ ] Timestamps em todos os logs
- [ ] Context e metadata incluídos
- [ ] Stack traces em erros

### Monitoring
- [ ] Supabase logs acessíveis e organizados
- [ ] Sistema de alertas configurado (opcional)
- [ ] Dashboard de saúde do sistema (opcional)
- [ ] Métricas de performance coletadas

### Error Tracking
- [ ] Erros logados com contexto completo
- [ ] Fallbacks testados
- [ ] Error responses padronizados
- [ ] Retry logic onde apropriado

---

## 🎨 Frontend

### Performance
- [ ] Lazy loading de componentes pesados
- [ ] Code splitting implementado
- [ ] Assets otimizados (imagens comprimidas)
- [ ] Cache strategy definida

### UX
- [ ] Loading states em todas as ações
- [ ] Error states com mensagens claras
- [ ] Skeleton loaders durante carregamento
- [ ] Feedback visual de sucesso/erro
- [ ] Mobile responsive

### SEO (se aplicável)
- [ ] Meta tags configuradas
- [ ] Open Graph tags
- [ ] Sitemap gerado
- [ ] robots.txt configurado

---

## 📖 Documentação

### Para Desenvolvedores
- [ ] README.md atualizado
- [ ] SETUP.md com instruções de setup
- [ ] DEVELOPMENT_PLAN.md atualizado
- [ ] API documentation (edge functions)
- [ ] Database schema documentado

### Para Usuários
- [ ] User guide criado
- [ ] Troubleshooting guide
- [ ] FAQ atualizado
- [ ] Video tutorials (opcional)

### Para Operações
- [ ] Deployment guide
- [ ] Rollback procedures
- [ ] Monitoring guide
- [ ] Incident response plan

---

## 🧪 Testes

### Funcionalidade
- [ ] Todos os testes do TESTING_GUIDE.md executados
- [ ] Happy paths testados
- [ ] Error paths testados
- [ ] Edge cases cobertos

### Performance
- [ ] Load test executado (10+ pedidos simultâneos)
- [ ] Response time aceitável (< 5s para AI)
- [ ] Database queries otimizadas
- [ ] Rate limiting validado

### Segurança
- [ ] Security scan executado
- [ ] Vulnerabilidades conhecidas mitigadas
- [ ] Input validation testada
- [ ] RLS policies auditadas

---

## 🚦 Deploy

### Pré-Deploy
- [ ] Todas as checklist items acima completas
- [ ] Stakeholders notificados
- [ ] Janela de manutenção agendada (se necessário)
- [ ] Rollback plan pronto

### Deploy Steps
- [ ] Backup do banco antes do deploy
- [ ] Deploy de migrations first
- [ ] Deploy de edge functions
- [ ] Deploy de frontend
- [ ] Smoke tests após deploy
- [ ] Monitoring ativo

### Pós-Deploy
- [ ] Verificar que sistema está up
- [ ] Executar smoke tests
- [ ] Monitorar logs por 1-2 horas
- [ ] Comunicar sucesso aos stakeholders

---

## 📞 Suporte

### Contatos
- [ ] Lista de contatos de emergência definida
- [ ] Escalation path documentado
- [ ] Horário de suporte definido

### Ferramentas
- [ ] Acesso aos logs configurado
- [ ] Acesso ao Supabase dashboard
- [ ] Ferramentas de monitoring configuradas
- [ ] Documentação facilmente acessível

---

## ✅ Sign-Off Final

Antes de marcar como "Production Ready", confirmar:

- [ ] **Tech Lead** - Revisou código e arquitetura
- [ ] **QA** - Executou todos os testes
- [ ] **Security** - Aprovou security scan
- [ ] **Product** - Validou funcionalidades
- [ ] **DevOps** - Infraestrutura pronta

**Data de Aprovação:** _______________

**Responsável:** _______________

**Assinatura:** _______________

---

## 🎯 Métricas de Sucesso (Pós-Deploy)

Monitorar nas primeiras semanas:

- [ ] **Uptime > 99.5%**
- [ ] **Response time médio < 3s**
- [ ] **Taxa de erro < 0.5%**
- [ ] **Taxa de conversão de pedidos > 70%**
- [ ] **Recovery rate > 15%**
- [ ] **Customer satisfaction > 4.0/5**

---

**Última atualização:** [DATA]

**Versão:** 1.0

**Status:** 🟡 Em Progresso | 🟢 Pronto | 🔴 Bloqueado
