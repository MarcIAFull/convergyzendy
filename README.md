# 🤖 Zendy AI - Sistema de Pedidos via WhatsApp com IA

> **Plataforma SaaS para restaurantes automatizarem pedidos via WhatsApp usando IA conversacional**

Zendy AI permite que restaurantes recebam e gerenciem pedidos automaticamente através do WhatsApp, com um assistente de IA que atua como vendedor ativo - navegando clientes pelo cardápio, montando carrinho, validando endereços de entrega, e finalizando pedidos.

![Status](https://img.shields.io/badge/status-development-yellow)
![Version](https://img.shields.io/badge/version-2.0.0-blue)

---

## 📋 Índice

- [Funcionalidades](#-funcionalidades)
- [Arquitetura](#-arquitetura)
- [Stack Tecnológica](#-stack-tecnológica)
- [Quick Start](#-quick-start)
- [Documentação](#-documentação)
- [Estado Atual do Desenvolvimento](#-estado-atual-do-desenvolvimento)

---

## ✨ Funcionalidades

### 🤖 IA Conversacional (Arquitetura Two-Agent)

| Componente | Função |
|------------|--------|
| **Orchestrator Agent** | Classifica intenção do usuário (browse_menu, provide_address, finalize, etc.) e determina próximo estado |
| **Conversational Agent** | Executa ações via 14 tools, gera respostas em português, aplica personalização do restaurante |

**Características:**
- Iterative Function Calling (loop até AI parar de chamar tools)
- RAG para Menu (só categorias no prompt, produtos via `search_menu` tool)
- RAG para Customer Insights (histórico via `get_customer_history` tool)
- Modelo de Vendedor Ativo (puxa próximo passo automaticamente)
- Anti-loop rules (não repete perguntas já respondidas)

### 📱 Integração WhatsApp

- **Evolution API** nativa
- QR Code setup via dashboard
- Webhook para receber mensagens
- Rate limiting e debounce de mensagens
- Reconexão automática

### 🛒 Gestão de Pedidos

- Dashboard em tempo real (4 colunas: New, Preparing, Delivery, Complete)
- Workflow de status com drag & drop
- Detalhes do pedido com itens, addons, endereço
- Real-time updates via Supabase subscriptions

### 📍 Sistema de Delivery

- Validação de endereço com geocoding
- Zonas de entrega com taxas configuráveis
- Cálculo automático de taxa por distância
- Verificação de pedido mínimo por zona

### 🔄 Recovery System

| Tipo | Delay | Descrição |
|------|-------|-----------|
| Carrinho Abandonado | 30 min | Itens no carrinho, cliente parou de responder |
| Conversa Pausada | 15 min | Conversa ativa, cliente parou |
| Cliente Inativo | 30 dias | Cliente antigo sem pedidos recentes |

### 📊 Analytics & CRM

- Métricas de receita, pedidos, ticket médio
- Top produtos
- Customer insights (frequência, preferências, histórico)
- Logs de interações AI

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTE                                    │
│                     (WhatsApp Mobile App)                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EVOLUTION API                                   │
│            (WhatsApp Business API Gateway)                          │
│                                                                      │
│  • Gerencia instâncias WhatsApp                                     │
│  • Envia/recebe mensagens                                           │
│  • Emite webhooks para eventos                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ webhook POST
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   SUPABASE EDGE FUNCTIONS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐     ┌──────────────────────────────────┐  │
│  │  whatsapp-webhook   │────▶│   process-debounced-messages     │  │
│  │  • Rate limiting    │     │   • Agrupa mensagens rápidas     │  │
│  │  • Valida payload   │     │   • Chama whatsapp-ai-agent      │  │
│  │  • Debounce queue   │     └──────────────┬───────────────────┘  │
│  └─────────────────────┘                    │                       │
│                                             ▼                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    whatsapp-ai-agent                          │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │              ORCHESTRATOR AGENT                         │  │  │
│  │  │  • Recebe mensagem do cliente                          │  │  │
│  │  │  • Classifica intenção (intent)                        │  │  │
│  │  │  • Determina próximo estado                            │  │  │
│  │  │  • Retorna JSON: {intent, target_state, confidence}    │  │  │
│  │  └────────────────────────┬───────────────────────────────┘  │  │
│  │                           ▼                                   │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │           CONVERSATIONAL AGENT (Iterative Loop)        │  │  │
│  │  │                                                         │  │  │
│  │  │  while (finish_reason == "tool_calls"):                │  │  │
│  │  │    1. Envia prompt + contexto para OpenAI              │  │  │
│  │  │    2. Recebe tool_calls da AI                          │  │  │
│  │  │    3. Executa tools (search_menu, add_to_cart, etc.)   │  │  │
│  │  │    4. Adiciona results ao messages[] com role:"tool"   │  │  │
│  │  │    5. Repete até AI gerar resposta final               │  │  │
│  │  │                                                         │  │  │
│  │  │  Tools disponíveis: 14 (ver ARCHITECTURE.md)           │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────┐     ┌─────────────────────────────────┐   │
│  │   whatsapp-send     │     │   conversation-recovery         │   │
│  │   • Envia mensagem  │     │   • Detecta carrinhos abandonados│  │
│  │   via Evolution API │     │   • Envia mensagens de recovery  │   │
│  └─────────────────────┘     └─────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────┐     ┌─────────────────────────────────┐   │
│  │   evolution-connect │     │   validate-delivery-address     │   │
│  │   evolution-status  │     │   • Geocoding de endereços      │   │
│  │   evolution-reset   │     │   • Validação de zona de entrega│   │
│  └─────────────────────┘     └─────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SUPABASE DATABASE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Core Tables:                    AI Tables:                         │
│  • restaurants                   • agents                           │
│  • categories                    • agent_prompt_blocks              │
│  • products                      • agent_tools                      │
│  • addons                        • ai_interaction_logs              │
│  • customers                     • conversation_state               │
│  • carts / cart_items            • conversation_pending_items       │
│  • orders                        • conversation_mode                │
│  • messages                      • conversation_recovery_attempts   │
│                                                                      │
│  Delivery Tables:                Config Tables:                     │
│  • delivery_zones                • restaurant_ai_settings           │
│  • address_cache                 • restaurant_settings              │
│  • distance_matrix_cache         • whatsapp_instances               │
│                                                                      │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ Real-time subscriptions
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     REACT FRONTEND (Dashboard)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Pages:                          Components:                        │
│  • /dashboard - Gestão pedidos   • OrderDetailsDrawer               │
│  • /messages - Chat conversas    • ConversationList / ChatArea      │
│  • /menu - Gestão cardápio       • ProductCard / ProductModal       │
│  • /analytics - Métricas         • CustomerDetails                  │
│  • /customers - CRM              • DeliveryZoneMap                  │
│  • /settings - Configurações     • AITestChatSimulator              │
│  • /whatsapp-connection          • + 50 componentes UI              │
│  • /ai-configuration                                                │
│                                                                      │
│  State Management: Zustand stores                                   │
│  UI Components: Shadcn/ui + Tailwind                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Shadcn/ui, Zustand |
| **Backend** | Supabase (PostgreSQL, Edge Functions, Realtime, Storage) |
| **AI** | OpenAI GPT-4o-mini (Orchestrator + Conversational) |
| **WhatsApp** | Evolution API (Baileys-based) |
| **Maps** | Google Geocoding API |

---

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+
- Conta Supabase
- Conta OpenAI com créditos
- Evolution API rodando (self-hosted ou managed)

### 1. Clone e Instale

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
```

### 2. Configure Variáveis de Ambiente

**Frontend (.env):**
```env
VITE_SUPABASE_URL=https://tgbfqcbqfdzrtbtlycve.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...
```

**Backend (Supabase Secrets):**
```
OPENAI_API_KEY=sk-...
EVOLUTION_API_URL=https://your-evolution.com
EVOLUTION_API_KEY=your-key
GOOGLE_GEOCODING_API_KEY=your-key
```

### 3. Execute

```bash
npm run dev
```

### 4. Conecte WhatsApp

1. Login → Complete onboarding
2. WhatsApp Connection → Connect
3. Escaneie QR Code
4. Teste enviando "Oi" para o número

---

## 📚 Documentação

| Documento | Descrição |
|-----------|-----------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Arquitetura técnica detalhada, fluxos de dados, tools |
| **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** | Estrutura de pastas e arquivos |
| **[SETUP.md](./SETUP.md)** | Guia completo de setup |
| **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** | Como testar cada funcionalidade |
| **[DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md)** | Como debugar problemas comuns |
| **[DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)** | Status atual e roadmap |

---

## 📊 Estado Atual do Desenvolvimento

### ✅ Implementado e Funcional

- [x] Dashboard de pedidos em tempo real
- [x] Gestão de menu (CRUD categorias, produtos, addons)
- [x] Integração WhatsApp via Evolution API
- [x] AI Agent com Two-Agent Architecture
- [x] Iterative Function Calling (14 tools)
- [x] Sistema de estados de conversa
- [x] Validação de endereço e zonas de entrega
- [x] Sistema de recovery (abandoned cart, paused conversation)
- [x] Analytics e customer insights
- [x] Configuração de AI por restaurante
- [x] Menu público e checkout web
- [x] Sistema de notificações

### 🔧 Em Refinamento

- [ ] Testes end-to-end automatizados
- [ ] Monitoramento de performance AI
- [ ] Otimização de prompts (token usage)

### 📅 Próximas Features

- [ ] Múltiplos restaurantes por usuário
- [ ] Programa de fidelidade
- [ ] Integração com PIX
- [ ] App mobile nativo

---

## 🔑 Secrets Configurados

```
OPENAI_API_KEY          - API key OpenAI
EVOLUTION_API_URL       - URL da Evolution API
EVOLUTION_API_KEY       - API key Evolution
EVOLUTION_INSTANCE_NAME - Nome da instância WhatsApp
GOOGLE_GEOCODING_API_KEY - API key Google Maps
SUPABASE_URL            - URL do projeto Supabase
SUPABASE_ANON_KEY       - Anon key Supabase
SUPABASE_SERVICE_ROLE_KEY - Service role key
LOVABLE_API_KEY         - API key Lovable (auto-gerado)
```

---

## 🐛 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| WhatsApp não conecta | Verificar EVOLUTION_API_URL sem `/` no final |
| AI não responde | Verificar OPENAI_API_KEY e créditos |
| Mensagens não chegam | Verificar webhook URL no Evolution API |
| Erro "instance not found" | Reconectar WhatsApp via dashboard |
| AI diz "não encontrei" mesmo com produtos | Bug de iterative loop - verificar logs |

**Logs úteis:**
- Edge Functions: Supabase Dashboard → Edge Functions → [função] → Logs
- Database: Supabase Dashboard → Database → Logs
- AI Interactions: Tabela `ai_interaction_logs`

---

## 📄 Licença

MIT License

---

## 💬 Suporte

- **Docs**: [./docs](./docs)
- **Lovable Project**: https://lovable.dev/projects/789c9398-6603-4ec0-a3d4-d716bc0d8031

---

**Última atualização**: 2025-12-02
**Versão**: 2.0.0
