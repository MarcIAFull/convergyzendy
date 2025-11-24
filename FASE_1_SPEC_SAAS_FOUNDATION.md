# Especificação Técnica - Fase 1: SaaS Foundation

## 📋 Visão Geral

Transformar o Zendy de MVP single-tenant para uma plataforma SaaS multi-tenant completa com sistema de assinaturas, billing automatizado via Stripe, e suporte completo para o mercado português.

### Objetivos Principais
- ✅ Sistema de planos e assinaturas (Starter, Business, Pro, Enterprise)
- ✅ Billing automatizado com Stripe
- ✅ Multi-tenancy real com isolamento de dados
- ✅ Subdomínios personalizados por restaurante
- ✅ Admin super-user para gestão da plataforma
- ✅ Localização completa para Portugal (PT-PT)
- ✅ Métodos de pagamento locais (MBWay, Multibanco)

---

## 💳 Sistema de Planos

### Estrutura de Planos

| Feature | Starter | Business | Pro | Enterprise |
|---------|---------|----------|-----|------------|
| **Preço/mês** | €29 | €79 | €149 | Custom |
| **Trial** | 14 dias | 14 dias | 14 dias | Demo |
| **Pedidos/mês** | 300 | 1.000 | Ilimitado | Ilimitado |
| **Usuários** | 1 | 3 | 10 | Ilimitado |
| **WhatsApp** | ✅ | ✅ | ✅ | ✅ |
| **Menu Público** | ❌ | ✅ | ✅ | ✅ |
| **Checkout Web** | ❌ | ❌ | ✅ | ✅ |
| **Delivery System** | ❌ | ✅ | ✅ | ✅ |
| **Analytics Avançado** | ❌ | ❌ | ✅ | ✅ |
| **API Access** | ❌ | ❌ | ✅ | ✅ |
| **Subdomínio Custom** | ❌ | ❌ | ✅ | ✅ |
| **White Label** | ❌ | ❌ | ❌ | ✅ |
| **Suporte** | Email | Email | Prioritário | Dedicado |
| **Onboarding** | Self-service | Self-service | Assistido | Personalizado |

---

## 🗄️ Database Schema

### Nova Tabela: `subscriptions`
```sql
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Stripe Integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT NOT NULL,
  
  -- Plano
  plan_name TEXT NOT NULL, -- 'starter', 'business', 'pro', 'enterprise'
  status TEXT NOT NULL DEFAULT 'trialing', -- 'trialing', 'active', 'past_due', 'canceled', 'incomplete'
  
  -- Datas
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  canceled_at TIMESTAMPTZ,
  
  -- Limites e Uso
  orders_limit INTEGER, -- null = ilimitado
  orders_used INTEGER DEFAULT 0,
  users_limit INTEGER DEFAULT 1,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_restaurant ON subscriptions(restaurant_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end);

-- RLS Policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their subscription"
  ON subscriptions FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));

-- Stripe webhooks podem atualizar subscriptions
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (true);
```

### Nova Tabela: `usage_logs`
```sql
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  
  -- Tipo de Uso
  event_type TEXT NOT NULL, -- 'order_created', 'message_sent', 'api_call', 'user_invited'
  
  -- Quantidades
  quantity INTEGER DEFAULT 1,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Particionamento por mês (performance)
CREATE INDEX idx_usage_logs_restaurant_date ON usage_logs(restaurant_id, created_at DESC);
CREATE INDEX idx_usage_logs_event_type ON usage_logs(event_type);

-- RLS
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their usage logs"
  ON usage_logs FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Service role can insert usage logs"
  ON usage_logs FOR INSERT
  WITH CHECK (true);
```

### Nova Tabela: `invoices`
```sql
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Stripe Integration
  stripe_invoice_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  
  -- Valores
  amount_due NUMERIC NOT NULL,
  amount_paid NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'open', 'paid', 'void', 'uncollectible'
  
  -- Datas
  invoice_date DATE NOT NULL,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  
  -- Detalhes
  invoice_number TEXT UNIQUE,
  invoice_pdf_url TEXT,
  
  -- Billing Info (snapshot no momento da invoice)
  billing_name TEXT,
  billing_email TEXT,
  billing_address JSONB,
  billing_tax_id TEXT, -- NIF em Portugal
  
  -- Items
  line_items JSONB NOT NULL DEFAULT '[]',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_invoices_restaurant ON invoices(restaurant_id);
CREATE INDEX idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date DESC);

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their invoices"
  ON invoices FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));
```

### Nova Tabela: `tenant_settings`
```sql
CREATE TABLE public.tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Subdomínio
  subdomain TEXT UNIQUE, -- pizzaria-bella.zendy.app
  custom_domain TEXT UNIQUE, -- www.pizzariabella.pt
  domain_verified BOOLEAN DEFAULT false,
  
  -- Branding (white-label para Enterprise)
  custom_logo_url TEXT,
  custom_favicon_url TEXT,
  primary_color TEXT,
  custom_css TEXT, -- CSS customizado (Enterprise only)
  
  -- Configurações regionais
  locale TEXT DEFAULT 'pt-PT', -- pt-PT, pt-BR, en-US
  timezone TEXT DEFAULT 'Europe/Lisbon',
  currency TEXT DEFAULT 'EUR',
  
  -- Configurações de comunicação
  email_from_name TEXT,
  email_reply_to TEXT,
  sms_sender_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE UNIQUE INDEX idx_tenant_settings_subdomain ON tenant_settings(subdomain);
CREATE UNIQUE INDEX idx_tenant_settings_custom_domain ON tenant_settings(custom_domain);

-- RLS
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their tenant settings"
  ON tenant_settings FOR ALL
  USING (user_has_restaurant_access(restaurant_id));
```

### Alterar Tabela: `restaurant_owners` (adicionar roles)
```sql
ALTER TABLE restaurant_owners 
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"orders": true, "menu": true, "analytics": true, "settings": false}';

-- Novos roles: 'owner', 'admin', 'manager', 'operator'
-- owner: full access
-- admin: tudo exceto billing
-- manager: orders, menu, analytics
-- operator: apenas orders
```

### Nova Tabela: `platform_admins`
```sql
CREATE TABLE public.platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Nível de acesso
  access_level TEXT NOT NULL DEFAULT 'support', -- 'super_admin', 'admin', 'support'
  
  -- Permissões específicas
  can_manage_subscriptions BOOLEAN DEFAULT false,
  can_view_all_restaurants BOOLEAN DEFAULT false,
  can_impersonate_users BOOLEAN DEFAULT false,
  can_manage_platform_settings BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES platform_admins(user_id)
);

-- RLS
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view other admins"
  ON platform_admins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage admins"
  ON platform_admins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins 
      WHERE user_id = auth.uid() 
        AND access_level = 'super_admin'
    )
  );
```

---

## 🔌 Stripe Integration

### Produtos e Preços no Stripe

#### Setup Inicial (via Stripe Dashboard ou API)
```typescript
// Script: setup-stripe-products.ts

const plans = [
  {
    name: 'Zendy Starter',
    id: 'starter',
    price: 29,
    currency: 'eur',
    interval: 'month',
    features: {
      orders_limit: 300,
      users_limit: 1,
      menu_enabled: false,
      checkout_web_enabled: false,
      delivery_enabled: false
    }
  },
  {
    name: 'Zendy Business',
    id: 'business',
    price: 79,
    currency: 'eur',
    interval: 'month',
    features: {
      orders_limit: 1000,
      users_limit: 3,
      menu_enabled: true,
      checkout_web_enabled: false,
      delivery_enabled: true
    }
  },
  {
    name: 'Zendy Pro',
    id: 'pro',
    price: 149,
    currency: 'eur',
    interval: 'month',
    features: {
      orders_limit: null, // ilimitado
      users_limit: 10,
      menu_enabled: true,
      checkout_web_enabled: true,
      delivery_enabled: true,
      api_access: true,
      custom_subdomain: true
    }
  }
];

for (const plan of plans) {
  // Criar produto
  const product = await stripe.products.create({
    name: plan.name,
    metadata: plan.features
  });
  
  // Criar preço
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.price * 100,
    currency: plan.currency,
    recurring: {
      interval: plan.interval,
      trial_period_days: 14
    }
  });
  
  console.log(`${plan.name}: ${price.id}`);
}
```

### Edge Functions

#### `create-subscription`
```typescript
// supabase/functions/create-subscription/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { restaurantId, priceId, paymentMethodId } = await req.json();

    // 1. Buscar restaurante
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*, tenant_settings(*)')
      .eq('id', restaurantId)
      .single();

    if (!restaurant) {
      throw new Error('Restaurante não encontrado');
    }

    // 2. Criar ou buscar Stripe Customer
    let customerId = restaurant.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: restaurant.email,
        name: restaurant.name,
        phone: restaurant.phone,
        metadata: {
          restaurant_id: restaurant.id,
          locale: restaurant.tenant_settings?.locale || 'pt-PT'
        }
      });
      customerId = customer.id;
    }

    // 3. Anexar método de pagamento
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
      
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    }

    // 4. Criar subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 14,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        restaurant_id: restaurant.id
      }
    });

    // 5. Salvar no banco
    const planName = getPlanNameFromPriceId(priceId);
    const planLimits = getPlanLimits(planName);

    await supabase.from('subscriptions').insert({
      restaurant_id: restaurant.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan_name: planName,
      status: subscription.status,
      trial_start: new Date(subscription.trial_start! * 1000),
      trial_end: new Date(subscription.trial_end! * 1000),
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      orders_limit: planLimits.orders_limit,
      users_limit: planLimits.users_limit
    });

    return new Response(
      JSON.stringify({ 
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getPlanNameFromPriceId(priceId: string): string {
  // Mapear priceId para plan name
  const priceMap = {
    'price_starter': 'starter',
    'price_business': 'business',
    'price_pro': 'pro'
  };
  return priceMap[priceId] || 'starter';
}

function getPlanLimits(planName: string) {
  const limits = {
    starter: { orders_limit: 300, users_limit: 1 },
    business: { orders_limit: 1000, users_limit: 3 },
    pro: { orders_limit: null, users_limit: 10 },
    enterprise: { orders_limit: null, users_limit: null }
  };
  return limits[planName] || limits.starter;
}
```

#### `stripe-webhook`
```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!;
  const body = await req.text();

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    );

    console.log(`Webhook received: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function handleSubscriptionUpdate(subscription: any) {
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  const subscriptionData = {
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0].price.id,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000),
    current_period_end: new Date(subscription.current_period_end * 1000),
    trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    updated_at: new Date()
  };

  if (existing) {
    await supabase
      .from('subscriptions')
      .update(subscriptionData)
      .eq('id', existing.id);
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  await supabase
    .from('subscriptions')
    .update({ 
      status: 'canceled',
      canceled_at: new Date()
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleInvoicePaid(invoice: any) {
  // Criar/atualizar invoice no banco
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('restaurant_id')
    .eq('stripe_subscription_id', invoice.subscription)
    .single();

  if (subscription) {
    await supabase.from('invoices').insert({
      restaurant_id: subscription.restaurant_id,
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: invoice.payment_intent,
      amount_due: invoice.amount_due / 100,
      amount_paid: invoice.amount_paid / 100,
      currency: invoice.currency.toUpperCase(),
      status: 'paid',
      invoice_date: new Date(invoice.created * 1000),
      paid_at: new Date(),
      invoice_number: invoice.number,
      invoice_pdf_url: invoice.invoice_pdf,
      billing_name: invoice.customer_name,
      billing_email: invoice.customer_email,
      line_items: invoice.lines.data
    });

    // Reset usage counter
    await supabase
      .from('subscriptions')
      .update({ orders_used: 0 })
      .eq('restaurant_id', subscription.restaurant_id);
  }
}

async function handleInvoicePaymentFailed(invoice: any) {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('restaurant_id')
    .eq('stripe_subscription_id', invoice.subscription)
    .single();

  if (subscription) {
    // Atualizar status
    await supabase
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('restaurant_id', subscription.restaurant_id);

    // Enviar notificação ao restaurante
    // TODO: implementar notificação de falha de pagamento
  }
}
```

---

## 🌍 Localização Portugal (PT-PT)

### Traduções

```typescript
// src/i18n/locales/pt-PT.ts

export const ptPT = {
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    add: 'Adicionar',
    search: 'Pesquisar',
    loading: 'A carregar...',
    error: 'Erro',
    success: 'Sucesso'
  },
  
  auth: {
    login: 'Entrar',
    logout: 'Sair',
    register: 'Registar',
    email: 'E-mail',
    password: 'Palavra-passe',
    forgotPassword: 'Esqueceu-se da palavra-passe?',
    resetPassword: 'Redefinir palavra-passe'
  },
  
  menu: {
    categories: 'Categorias',
    products: 'Produtos',
    addProduct: 'Adicionar Produto',
    price: 'Preço',
    available: 'Disponível',
    unavailable: 'Indisponível'
  },
  
  orders: {
    newOrder: 'Novo Pedido',
    pending: 'Pendente',
    confirmed: 'Confirmado',
    preparing: 'A preparar',
    ready: 'Pronto',
    delivered: 'Entregue',
    cancelled: 'Cancelado',
    deliveryAddress: 'Morada de Entrega',
    paymentMethod: 'Método de Pagamento',
    total: 'Total'
  },
  
  subscription: {
    plan: 'Plano',
    currentPlan: 'Plano Atual',
    upgradePlan: 'Melhorar Plano',
    cancelSubscription: 'Cancelar Subscrição',
    trialEndsIn: 'Teste termina em {days} dias',
    ordersUsed: '{used} de {limit} pedidos utilizados',
    unlimited: 'Ilimitado'
  },
  
  paymentMethods: {
    cash: 'Dinheiro',
    card: 'Cartão',
    mbway: 'MB WAY',
    multibanco: 'Multibanco',
    bankTransfer: 'Transferência Bancária'
  }
};
```

### Validação de Telefone PT
```typescript
// src/lib/validators.ts

export function validatePortuguesePhone(phone: string): boolean {
  // Remover espaços e caracteres especiais
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Formatos aceites:
  // +351 912 345 678
  // 00351 912 345 678
  // 912 345 678
  const regex = /^(?:\+351|00351|351)?9[1236]\d{7}$/;
  
  return regex.test(cleaned);
}

export function formatPortuguesePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Se começar com +351 ou 00351, remover
  let number = cleaned.replace(/^(\+351|00351|351)/, '');
  
  // Formatar: 912 345 678
  if (number.length === 9) {
    return `+351 ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
  }
  
  return phone;
}
```

### NIF (Número de Identificação Fiscal)
```typescript
// src/lib/validators.ts

export function validateNIF(nif: string): boolean {
  // Remover espaços
  const cleaned = nif.replace(/\s/g, '');
  
  // Deve ter exatamente 9 dígitos
  if (!/^\d{9}$/.test(cleaned)) {
    return false;
  }
  
  // Validar dígito de controle
  const digits = cleaned.split('').map(Number);
  const checkSum = digits
    .slice(0, 8)
    .reduce((sum, digit, index) => sum + digit * (9 - index), 0);
  
  const checkDigit = 11 - (checkSum % 11);
  const expectedCheckDigit = checkDigit >= 10 ? 0 : checkDigit;
  
  return digits[8] === expectedCheckDigit;
}
```

---

## 🎨 Componentes Frontend

### Estrutura de Páginas

```
src/pages/admin/
├── PlatformDashboard.tsx   # Dashboard super-admin
├── RestaurantsList.tsx      # Lista de todos os restaurantes
├── SubscriptionManagement.tsx # Gestão de assinaturas
└── PlatformSettings.tsx     # Configurações da plataforma

src/pages/billing/
├── Subscription.tsx         # Página de assinatura do restaurante
├── BillingHistory.tsx       # Histórico de faturas
├── PaymentMethods.tsx       # Métodos de pagamento
└── UpgradePlan.tsx          # Upgrade de plano

src/components/billing/
├── PlanCard.tsx             # Card de plano
├── PlanComparison.tsx       # Tabela comparativa
├── UsageIndicator.tsx       # Indicador de uso (pedidos/mês)
├── PaymentMethodForm.tsx    # Form para adicionar cartão
├── InvoiceTable.tsx         # Tabela de faturas
└── SubscriptionAlert.tsx    # Alertas (trial ending, limit reached)

src/components/admin/
├── RestaurantCard.tsx       # Card com info do restaurante
├── ImpersonateButton.tsx    # Botão para impersonar usuário
├── SubscriptionBadge.tsx    # Badge com status da subscription
└── PlatformMetrics.tsx      # Métricas gerais da plataforma
```

### Hook de Subscription
```typescript
// src/hooks/useSubscription.ts

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurantStore } from '@/stores/restaurantStore';

export interface Subscription {
  id: string;
  plan_name: string;
  status: string;
  trial_end: string | null;
  current_period_end: string;
  orders_limit: number | null;
  orders_used: number;
  users_limit: number;
}

export function useSubscription() {
  const { restaurant } = useRestaurantStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurant?.id) return;

    fetchSubscription();

    // Real-time updates
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        () => fetchSubscription()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);

  async function fetchSubscription() {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('restaurant_id', restaurant!.id)
      .single();

    if (data) {
      setSubscription(data);
    }
    setLoading(false);
  }

  const canCreateOrder = () => {
    if (!subscription) return false;
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return false;
    }
    if (subscription.orders_limit === null) return true;
    return subscription.orders_used < subscription.orders_limit;
  };

  const isTrialing = () => {
    return subscription?.status === 'trialing';
  };

  const daysUntilTrialEnd = () => {
    if (!subscription?.trial_end) return null;
    const now = new Date();
    const end = new Date(subscription.trial_end);
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const usagePercentage = () => {
    if (!subscription || subscription.orders_limit === null) return 0;
    return (subscription.orders_used / subscription.orders_limit) * 100;
  };

  return {
    subscription,
    loading,
    canCreateOrder,
    isTrialing,
    daysUntilTrialEnd,
    usagePercentage
  };
}
```

### Middleware de Feature Gates
```typescript
// src/lib/featureGates.ts

import { Subscription } from '@/hooks/useSubscription';

export const featureGates = {
  publicMenu: (subscription: Subscription | null) => {
    if (!subscription) return false;
    return ['business', 'pro', 'enterprise'].includes(subscription.plan_name);
  },

  checkoutWeb: (subscription: Subscription | null) => {
    if (!subscription) return false;
    return ['pro', 'enterprise'].includes(subscription.plan_name);
  },

  deliverySystem: (subscription: Subscription | null) => {
    if (!subscription) return false;
    return ['business', 'pro', 'enterprise'].includes(subscription.plan_name);
  },

  advancedAnalytics: (subscription: Subscription | null) => {
    if (!subscription) return false;
    return ['pro', 'enterprise'].includes(subscription.plan_name);
  },

  apiAccess: (subscription: Subscription | null) => {
    if (!subscription) return false;
    return ['pro', 'enterprise'].includes(subscription.plan_name);
  },

  customSubdomain: (subscription: Subscription | null) => {
    if (!subscription) return false;
    return ['pro', 'enterprise'].includes(subscription.plan_name);
  },

  whiteLabel: (subscription: Subscription | null) => {
    if (!subscription) return false;
    return subscription.plan_name === 'enterprise';
  },

  multipleUsers: (subscription: Subscription | null, currentUsers: number) => {
    if (!subscription) return false;
    return currentUsers < subscription.users_limit;
  }
};
```

---

## 🚀 Implementação Faseada

### Sprint 1 (Semana 1): Database + Stripe Backend
**Tasks:**
- [ ] Criar migrations: subscriptions, usage_logs, invoices, tenant_settings
- [ ] Alterar restaurant_owners: adicionar permissions
- [ ] Criar platform_admins table
- [ ] Setup Stripe products & prices
- [ ] Edge function: create-subscription
- [ ] Edge function: stripe-webhook
- [ ] Testes de webhook

**Entrega:** Backend de billing funcional

### Sprint 2 (Semana 1-2): Frontend de Billing
**Tasks:**
- [ ] Página Subscription
- [ ] Componente PlanCard
- [ ] Componente PlanComparison
- [ ] Hook useSubscription
- [ ] Feature gates middleware
- [ ] Alertas de limite/trial ending
- [ ] Página BillingHistory

**Entrega:** UI completa de gestão de assinatura

### Sprint 3 (Semana 2): Multi-tenancy
**Tasks:**
- [ ] Sistema de subdomínios
- [ ] Tenant isolation validations
- [ ] Middleware de tenant context
- [ ] Página TenantSettings
- [ ] Custom domain setup (DNS)

**Entrega:** Multi-tenancy funcional

### Sprint 4 (Semana 2-3): Localização PT
**Tasks:**
- [ ] Sistema i18n completo
- [ ] Traduções PT-PT
- [ ] Validadores PT (telefone, NIF)
- [ ] Métodos pagamento PT (MBWay, Multibanco)
- [ ] Formatação moeda/data PT

**Entrega:** Plataforma totalmente em PT-PT

### Sprint 5 (Semana 3): Admin Dashboard
**Tasks:**
- [ ] PlatformDashboard
- [ ] RestaurantsList
- [ ] Impersonation system
- [ ] Subscription management
- [ ] Platform metrics
- [ ] Audit logs

**Entrega:** Dashboard de super-admin

---

## 📊 Métricas e KPIs

### Métricas de Negócio
- **MRR (Monthly Recurring Revenue)**: Receita recorrente mensal
- **Churn Rate**: % de cancelamentos por mês
- **ARPU (Average Revenue Per User)**: Receita média por restaurante
- **LTV (Lifetime Value)**: Valor vitalício do cliente
- **CAC (Customer Acquisition Cost)**: Custo de aquisição

### Métricas de Produto
- **Trial Conversion Rate**: % que converte trial → paid
- **Upgrade Rate**: % que faz upgrade de plano
- **Feature Adoption**: % que usa cada feature
- **Active Restaurants**: Restaurantes ativos por plano

### Alertas Críticos
```typescript
// Edge function: check-subscription-health
// Executar diariamente via cron

// 1. Trials terminando em 3 dias
// 2. Subscriptions past_due há mais de 7 dias
// 3. Restaurantes próximos ao limite de pedidos
// 4. Falhas de pagamento
```

---

## 🔐 Segurança

### RLS Policies Críticas
```sql
-- Garantir que usuários só veem dados do seu tenant
CREATE POLICY "Tenant isolation"
  ON orders FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id 
      FROM restaurant_owners 
      WHERE user_id = auth.uid()
    )
  );
```

### Validação de Limites
```typescript
// Validar antes de criar pedido
async function validateOrderCreation(restaurantId: string) {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .single();

  if (!subscription) {
    throw new Error('Sem assinatura ativa');
  }

  if (subscription.status === 'canceled' || subscription.status === 'past_due') {
    throw new Error('Assinatura inativa. Por favor, atualize seu método de pagamento.');
  }

  if (subscription.orders_limit !== null) {
    if (subscription.orders_used >= subscription.orders_limit) {
      throw new Error('Limite mensal de pedidos atingido. Faça upgrade do seu plano.');
    }
  }

  return true;
}
```

---

## 📝 Checklist Final

- [ ] Todos os planos criados no Stripe
- [ ] Webhook configurado e testado
- [ ] RLS policies auditadas
- [ ] Feature gates implementados
- [ ] Validações de limite testadas
- [ ] Localização PT-PT completa
- [ ] Métodos pagamento PT configurados
- [ ] Admin dashboard funcional
- [ ] Documentação de billing
- [ ] Trial automático funcionando
- [ ] Emails de cobrança configurados
