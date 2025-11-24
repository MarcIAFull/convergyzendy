# 🤖 Zendy AI - Intelligent Restaurant Ordering System

> **Sistema completo de pedidos via WhatsApp com IA conversacional**

Zendy AI é uma plataforma all-in-one que permite restaurantes receberem e gerenciarem pedidos através do WhatsApp, com um assistente de IA que conversa naturalmente com clientes, processa pedidos, e recupera conversas abandonadas.

![Status](https://img.shields.io/badge/status-production_ready-green)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

---

## ✨ Características Principais

### 🤖 AI Conversacional
- Orquestrador Inteligente com detecção de intenção
- Agent Multi-Tool com 20+ ferramentas
- Personalizável por restaurante (tom, saudação, upselling)
- Context-Aware com histórico do cliente

### 📱 WhatsApp Integration
- Evolution API nativa
- QR Code setup simples
- Reconexão automática
- Rate limiting e proteção contra spam

### 🔄 Recovery System
- Abandoned Cart Recovery (30min)
- Paused Conversation Recovery (15min)
- Inactive Customer Reengagement (30 dias)
- Smart Cooldown de 24h

### 📊 Dashboard Completo
- Real-time orders e mensagens
- Customer insights
- Analytics detalhado
- Menu management

---

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- Conta Supabase
- Conta OpenAI
- Evolution API rodando

### Setup

```bash
# Clone
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install
npm install

# Configure .env.local
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-key

# Start
npm run dev
```

### Configure Secrets no Supabase

Edge Functions > Secrets:
```
OPENAI_API_KEY=sk-...
EVOLUTION_API_URL=https://...
EVOLUTION_API_KEY=...
```

### Conecte WhatsApp

1. Login no sistema
2. Complete onboarding
3. WhatsApp Connection > Connect
4. Escaneie QR Code

✅ Pronto!

---

## 📚 Documentação

- **[SETUP.md](./SETUP.md)** - Setup completo
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Como testar
- **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** - Checklist de produção
- **[DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)** - Roadmap

---

## 🏗️ Tecnologias

**Frontend:** React 18, TypeScript, Vite, TailwindCSS, Shadcn/ui  
**Backend:** Supabase (PostgreSQL, Edge Functions, Realtime)  
**AI:** OpenAI GPT-4  
**WhatsApp:** Evolution API

---

## 📋 Arquitetura

```
WhatsApp User
    ↓
Evolution API (Webhook)
    ↓
whatsapp-webhook (Rate Limiting)
    ↓
whatsapp-ai-agent (Orchestrator + AI + Tools)
    ↓
Supabase (Orders, Messages, State)
    ↓
React Dashboard (Real-time)
```

---

## 🧪 Testes

Execute todos os testes do [TESTING_GUIDE.md](./TESTING_GUIDE.md):

- WhatsApp Integration End-to-End
- Sistema de Recovery
- Error Handling
- Rate Limiting
- Notificações

---

## 🚀 Deploy

### Backend (Supabase)
```bash
supabase functions deploy
```

### Frontend (Vercel/Netlify)
```bash
npm run build
vercel --prod
```

Configure webhook no Evolution API:
```
https://your-project.supabase.co/functions/v1/whatsapp-webhook
```

---

## 🛠️ Troubleshooting

**WhatsApp não conecta:** Verifique EVOLUTION_API_URL (sem `/` no final)  
**AI não responde:** Verifique OPENAI_API_KEY e créditos  
**Recovery não funciona:** Verifique `agents.recovery_config.enabled = true`

Mais ajuda: [TESTING_GUIDE.md](./TESTING_GUIDE.md)

---

## 📄 Licença

MIT License - veja [LICENSE](./LICENSE)

---

## 💬 Suporte

- **Email**: support@zendy.ai
- **Issues**: [GitHub Issues](https://github.com/your-org/zendy-ai/issues)
- **Docs**: [./docs](./docs)

---

**Feito com ❤️ pela equipe Zendy**

**URL do Projeto**: https://lovable.dev/projects/789c9398-6603-4ec0-a3d4-d716bc0d8031
