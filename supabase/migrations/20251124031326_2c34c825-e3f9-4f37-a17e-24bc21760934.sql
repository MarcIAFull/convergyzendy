-- ============================================================================
-- FASE 1: SaaS Foundation - Database Schema
-- ============================================================================

-- 1. CRIAR ENUM PARA APP ROLES (se não existir)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. TABELA: subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Stripe Integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT NOT NULL,
  
  -- Plano
  plan_name TEXT NOT NULL CHECK (plan_name IN ('starter', 'business', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  
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

-- Indexes para subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant ON subscriptions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end ON subscriptions(trial_end);

-- RLS para subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their subscription"
  ON subscriptions FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (true);

-- 3. TABELA: usage_logs
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  
  -- Tipo de Uso
  event_type TEXT NOT NULL CHECK (event_type IN ('order_created', 'message_sent', 'api_call', 'user_invited')),
  
  -- Quantidades
  quantity INTEGER DEFAULT 1,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para usage_logs
CREATE INDEX IF NOT EXISTS idx_usage_logs_restaurant_date ON usage_logs(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_event_type ON usage_logs(event_type);

-- RLS para usage_logs
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their usage logs"
  ON usage_logs FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Service role can insert usage logs"
  ON usage_logs FOR INSERT
  WITH CHECK (true);

-- 4. TABELA: invoices
CREATE TABLE IF NOT EXISTS public.invoices (
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
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  
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

-- Indexes para invoices
CREATE INDEX IF NOT EXISTS idx_invoices_restaurant ON invoices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date DESC);

-- RLS para invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their invoices"
  ON invoices FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));

-- 5. TABELA: tenant_settings
CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Subdomínio
  subdomain TEXT UNIQUE,
  custom_domain TEXT UNIQUE,
  domain_verified BOOLEAN DEFAULT false,
  
  -- Branding (white-label para Enterprise)
  custom_logo_url TEXT,
  custom_favicon_url TEXT,
  primary_color TEXT,
  custom_css TEXT,
  
  -- Configurações regionais
  locale TEXT DEFAULT 'pt-PT' CHECK (locale IN ('pt-PT', 'pt-BR', 'en-US')),
  timezone TEXT DEFAULT 'Europe/Lisbon',
  currency TEXT DEFAULT 'EUR',
  
  -- Configurações de comunicação
  email_from_name TEXT,
  email_reply_to TEXT,
  sms_sender_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para tenant_settings
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_settings_subdomain ON tenant_settings(subdomain);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_settings_custom_domain ON tenant_settings(custom_domain);

-- RLS para tenant_settings
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their tenant settings"
  ON tenant_settings FOR ALL
  USING (user_has_restaurant_access(restaurant_id));

-- 6. TABELA: platform_admins
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Nível de acesso
  access_level TEXT NOT NULL DEFAULT 'support' CHECK (access_level IN ('super_admin', 'admin', 'support')),
  
  -- Permissões específicas
  can_manage_subscriptions BOOLEAN DEFAULT false,
  can_view_all_restaurants BOOLEAN DEFAULT false,
  can_impersonate_users BOOLEAN DEFAULT false,
  can_manage_platform_settings BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES platform_admins(user_id)
);

-- RLS para platform_admins
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

-- 7. ALTERAR TABELA: restaurant_owners (adicionar permissions)
ALTER TABLE restaurant_owners 
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"orders": true, "menu": true, "analytics": true, "settings": false}';

-- 8. ALTERAR TABELA: restaurants (adicionar slug e stripe_customer_id)
ALTER TABLE restaurants 
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Gerar slugs para restaurantes existentes (se não tiverem)
UPDATE restaurants 
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Garantir unicidade de slug
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_slug_unique ON restaurants(slug);

-- 9. ALTERAR TABELA: products (campos para fase 2 - menu público)
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergens TEXT[],
  ADD COLUMN IF NOT EXISTS nutritional_info JSONB;

-- Indexes para products
CREATE INDEX IF NOT EXISTS idx_products_display_order ON products(display_order);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = true;

-- 10. TRIGGER: atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas tabelas novas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscriptions_updated_at') THEN
    CREATE TRIGGER update_subscriptions_updated_at
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_invoices_updated_at') THEN
    CREATE TRIGGER update_invoices_updated_at
      BEFORE UPDATE ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenant_settings_updated_at') THEN
    CREATE TRIGGER update_tenant_settings_updated_at
      BEFORE UPDATE ON tenant_settings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 11. FUNÇÃO: incrementar usage automaticamente quando pedido é criado
CREATE OR REPLACE FUNCTION increment_subscription_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Buscar subscription do restaurante
  SELECT id INTO v_subscription_id
  FROM subscriptions
  WHERE restaurant_id = NEW.restaurant_id
    AND status IN ('active', 'trialing')
  LIMIT 1;

  IF v_subscription_id IS NOT NULL THEN
    -- Incrementar orders_used
    UPDATE subscriptions
    SET orders_used = orders_used + 1
    WHERE id = v_subscription_id;

    -- Registrar no log
    INSERT INTO usage_logs (restaurant_id, subscription_id, event_type, quantity)
    VALUES (NEW.restaurant_id, v_subscription_id, 'order_created', 1);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para incrementar usage quando pedido é criado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_increment_subscription_usage') THEN
    CREATE TRIGGER trigger_increment_subscription_usage
      AFTER INSERT ON orders
      FOR EACH ROW
      EXECUTE FUNCTION increment_subscription_usage();
  END IF;
END $$;

-- 12. COMENTÁRIOS (documentação)
COMMENT ON TABLE subscriptions IS 'Assinaturas dos restaurantes - integração com Stripe';
COMMENT ON TABLE usage_logs IS 'Log de uso de recursos por restaurante';
COMMENT ON TABLE invoices IS 'Faturas geradas pelo Stripe';
COMMENT ON TABLE tenant_settings IS 'Configurações de tenant (subdomínio, branding)';
COMMENT ON TABLE platform_admins IS 'Administradores da plataforma Zendy';

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================