# Estrutura do Projeto - Zendy AI

Este documento descreve a organização completa de arquivos e pastas do projeto.

---

## 📁 Estrutura de Diretórios

```
zendy-ai/
├── 📁 src/                          # Código fonte frontend
│   ├── 📁 components/               # Componentes React
│   │   ├── 📁 ui/                   # Shadcn/ui components (50+)
│   │   ├── 📁 admin/                # Componentes admin
│   │   ├── 📁 ai-config/            # Componentes de config AI
│   │   ├── 📁 delivery/             # Componentes de delivery
│   │   ├── 📁 messages/             # Componentes de chat
│   │   ├── 📁 onboarding/           # Steps do onboarding
│   │   ├── 📁 public/               # Menu público
│   │   ├── 📁 settings/             # Tabs de configuração
│   │   └── 📁 team/                 # Gestão de equipe
│   │
│   ├── 📁 pages/                    # Páginas/rotas
│   │   ├── 📁 public/               # Páginas públicas (menu)
│   │   └── *.tsx                    # Páginas do dashboard
│   │
│   ├── 📁 stores/                   # Zustand stores
│   ├── 📁 hooks/                    # Custom hooks
│   ├── 📁 contexts/                 # React contexts
│   ├── 📁 layouts/                  # Layout wrappers
│   ├── 📁 providers/                # Providers (theme, etc.)
│   ├── 📁 types/                    # TypeScript types
│   ├── 📁 lib/                      # Utilitários
│   ├── 📁 integrations/             # Integrações externas
│   │   └── 📁 supabase/             # Cliente Supabase
│   └── 📁 assets/                   # Assets estáticos
│
├── 📁 supabase/                     # Backend Supabase
│   ├── 📁 functions/                # Edge Functions
│   │   ├── 📁 _shared/              # Código compartilhado
│   │   ├── 📁 whatsapp-webhook/     # Webhook Evolution API
│   │   ├── 📁 whatsapp-ai-agent/    # Agente AI principal
│   │   ├── 📁 whatsapp-send/        # Envio de mensagens
│   │   └── ...                      # Outras funções
│   ├── 📁 migrations/               # Migrações SQL
│   └── config.toml                  # Config Supabase
│
├── 📁 public/                       # Assets públicos
├── 📁 tests/                        # Testes (em desenvolvimento)
└── 📁 docs/                         # Documentação adicional
```

---

## 📄 Arquivos Principais

### Frontend - Pages (`src/pages/`)

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `Dashboard.tsx` | `/` | Dashboard de pedidos em tempo real |
| `Messages.tsx` | `/messages` | Chat com clientes |
| `MenuManagement.tsx` | `/menu` | CRUD de cardápio |
| `Analytics.tsx` | `/analytics` | Métricas e gráficos |
| `Customers.tsx` | `/customers` | CRM de clientes |
| `Settings.tsx` | `/settings` | Configurações do restaurante |
| `SettingsUnified.tsx` | `/settings-unified` | Settings com todas as tabs |
| `WhatsAppConnection.tsx` | `/whatsapp-connection` | Setup WhatsApp |
| `AIConfiguration.tsx` | `/ai-configuration` | Config dos agentes AI |
| `RestaurantAISettings.tsx` | `/restaurant-ai-settings` | Personalização AI |
| `DeliveryZones.tsx` | `/delivery-zones` | Zonas de entrega |
| `TeamManagement.tsx` | `/team` | Gestão de equipe |
| `Admin.tsx` | `/admin` | Painel admin (platform) |
| `AILogs.tsx` | `/ai-logs` | Logs de interações AI |
| `Onboarding.tsx` | `/onboarding` | Wizard de setup |
| `Login.tsx` | `/login` | Autenticação |
| `Landing.tsx` | `/landing` | Landing page |
| `TestWhatsApp.tsx` | `/test-whatsapp` | Simulador de chat |
| `SystemCheck.tsx` | `/system-check` | Checklist de validação |
| `OrderDetail.tsx` | `/orders/:id` | Detalhe do pedido |
| `Subscription.tsx` | `/subscription` | Gestão de assinatura |

### Frontend - Pages Públicas (`src/pages/public/`)

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `PublicMenu.tsx` | `/m/:slug` | Menu público do restaurante |
| `PublicCart.tsx` | `/m/:slug/cart` | Carrinho público |
| `PublicCheckout.tsx` | `/m/:slug/checkout` | Checkout web |
| `PublicOrderConfirmed.tsx` | `/m/:slug/confirmed` | Confirmação de pedido |

### Frontend - Components (`src/components/`)

#### UI Components (`ui/`)
Todos os componentes Shadcn/ui (accordion, button, card, dialog, etc.)

#### Feature Components

| Pasta | Componentes Principais |
|-------|----------------------|
| `messages/` | `ChatArea`, `ConversationList`, `CustomerDetails`, `LiveCart` |
| `ai-config/` | `PromptBlocksEditor`, `ToolsManager`, `ModelSettings`, `BehaviorSettings` |
| `delivery/` | `AddressInput`, `DeliveryZoneMap` |
| `public/` | `ProductCard`, `ProductModal`, `CartFloatingButton`, `MenuHeader` |
| `settings/` | `RestaurantTab`, `WhatsAppTab`, `AIPersonalizationTab`, `PublicMenuTab` |
| `onboarding/` | `RestaurantInfoStep`, `MenuSetupStep`, `WhatsAppSetupStep` |

### Frontend - Stores (`src/stores/`)

| Arquivo | Descrição |
|---------|-----------|
| `orderStore.ts` | Estado de pedidos, real-time subscriptions |
| `conversationsStore.ts` | Conversas, mensagens, modo (AI/human) |
| `menuStore.ts` | Categorias, produtos, addons |
| `restaurantStore.ts` | Dados do restaurante atual |
| `customersStore.ts` | Lista de clientes |
| `analyticsStore.ts` | Métricas e analytics |
| `publicMenuStore.ts` | Menu público (cliente final) |
| `publicCartStore.ts` | Carrinho público |
| `subscriptionStore.ts` | Assinatura do restaurante |
| `tenantStore.ts` | Configurações multi-tenant |

### Frontend - Hooks (`src/hooks/`)

| Arquivo | Descrição |
|---------|-----------|
| `useAuth.tsx` | Autenticação e sessão |
| `useRestaurantGuard.tsx` | Proteção de rotas por restaurante |
| `useGeocoding.tsx` | Geocoding de endereços |
| `useGoogleMapsApiKey.tsx` | API key do Google Maps |
| `useMenuColors.tsx` | Cores dinâmicas do menu |
| `useTimeAgo.tsx` | Formatação de tempo relativo |
| `use-mobile.tsx` | Detecção de mobile |
| `use-toast.ts` | Sistema de toasts |

### Frontend - Types (`src/types/`)

| Arquivo | Descrição |
|---------|-----------|
| `database.ts` | Types das tabelas do banco |
| `conversation.ts` | Types de conversa e mensagens |
| `agent.ts` | Types dos agentes AI |
| `public-menu.ts` | Types do menu público |
| `restaurant-ai-settings.ts` | Types de config AI |

---

## 📁 Backend - Edge Functions (`supabase/functions/`)

### Core WhatsApp

| Função | Descrição |
|--------|-----------|
| `whatsapp-webhook/` | Recebe eventos do Evolution API |
| `whatsapp-ai-agent/` | Processa mensagens com IA |
| `whatsapp-send/` | Envia mensagens via Evolution |
| `process-debounced-messages/` | Processa fila de debounce |

### whatsapp-ai-agent/ (Detalhado)

```
whatsapp-ai-agent/
├── index.ts                    # Entry point, iterative loop principal
├── orchestrator-prompt.ts      # Prompt do Orchestrator Agent
├── conversational-ai-prompt.ts # Prompt do Conversational Agent
├── context-builder.ts          # Monta contexto da conversa
├── base-tools.ts              # Definição das 14 tools
├── product-detection.ts        # Detecção de produtos em texto
└── state-prompts.ts           # Prompts por estado (deprecated)
```

### Evolution API

| Função | Descrição |
|--------|-----------|
| `evolution-connect/` | Cria/conecta instância WhatsApp |
| `evolution-status/` | Verifica status da instância |
| `evolution-reset/` | Reseta instância |
| `evolution-test-message/` | Envia mensagem de teste |

### Delivery & Geocoding

| Função | Descrição |
|--------|-----------|
| `validate-delivery-address/` | Valida endereço e calcula taxa |
| `geocode-address-free/` | Geocoding gratuito (fallback) |
| `get-maps-api-key/` | Retorna API key do Google Maps |

### Recovery & Team

| Função | Descrição |
|--------|-----------|
| `conversation-recovery/` | Sistema de recovery |
| `send-team-invitation/` | Envia convite de equipe |
| `accept-team-invitation/` | Aceita convite |

### Shared (`_shared/`)

| Arquivo | Descrição |
|---------|-----------|
| `authMiddleware.ts` | Autenticação de requisições |
| `evolutionClient.ts` | Cliente Evolution API |
| `customerInsights.ts` | Cálculo de insights |
| `errorHandler.ts` | Tratamento de erros |
| `rateLimiter.ts` | Rate limiting |

---

## 📄 Arquivos de Configuração

### Root

| Arquivo | Descrição |
|---------|-----------|
| `vite.config.ts` | Configuração Vite |
| `tailwind.config.ts` | Configuração Tailwind |
| `tsconfig.json` | Configuração TypeScript |
| `eslint.config.js` | Configuração ESLint |
| `index.html` | HTML entry point |
| `.env` | Variáveis de ambiente |

### Supabase

| Arquivo | Descrição |
|---------|-----------|
| `supabase/config.toml` | Configuração local Supabase |
| `supabase/seed-agent-prompts.sql` | Seed dos prompts AI |
| `supabase/update-agent-models.sql` | Atualização de modelos |

---

## 🎨 Design System

### Cores (index.css)

```css
:root {
  /* Core */
  --background: 0 0% 100%;
  --foreground: 20 14.3% 4.1%;
  --primary: 24.6 95% 53.1%;      /* Orange - brand */
  --secondary: 60 4.8% 95.9%;
  --accent: 25 95% 97%;
  
  /* Status */
  --destructive: 0 84.2% 60.2%;   /* Red */
  --success: 142.1 76.2% 36.3%;   /* Green */
  
  /* Gradients */
  --gradient-primary: linear-gradient(135deg, hsl(var(--primary)), hsl(0 84% 60%));
}
```

### Tipografia

- **Display**: Inter (headers)
- **Body**: Inter (text)
- **Mono**: Fira Code (code)

### Componentes

Todos os componentes seguem o design system Shadcn/ui com customizações em:
- `src/components/ui/` (componentes base)
- `tailwind.config.ts` (extensões)
- `src/index.css` (variáveis CSS)

---

## 📊 Database Schema (Resumo)

Ver `ARCHITECTURE.md` para schema completo.

### Grupos de Tabelas

1. **Restaurant**: restaurants, restaurant_settings, restaurant_ai_settings
2. **Menu**: categories, products, addons
3. **Customers**: customers, customer_insights
4. **Orders**: carts, cart_items, orders
5. **Chat**: messages, conversation_state, conversation_mode
6. **AI**: agents, agent_prompt_blocks, agent_tools, ai_interaction_logs
7. **WhatsApp**: whatsapp_instances, message_debounce_queue
8. **Delivery**: delivery_zones, address_cache
9. **Recovery**: conversation_recovery_attempts
10. **Team**: restaurant_owners, team_invitations
11. **Billing**: subscriptions, invoices, usage_logs

---

## 🔐 Segurança

### RLS (Row Level Security)

Todas as tabelas têm RLS habilitado. Policies principais:

- Users só acessam dados do próprio restaurante
- Autenticação obrigatória para operações de escrita
- Storage público apenas para imagens de produtos

### Secrets

Gerenciados via Supabase Dashboard → Edge Functions → Secrets

---

## 🧪 Testes

```
tests/
├── unit/         # Testes unitários (em desenvolvimento)
├── integration/  # Testes de integração
├── e2e/          # Testes end-to-end
├── fixtures/     # Dados de teste
└── README.md     # Guia de testes
```

---

**Última atualização**: 2025-12-02
