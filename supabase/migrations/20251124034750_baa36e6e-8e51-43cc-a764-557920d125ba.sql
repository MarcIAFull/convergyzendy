-- Fase 2: Menu Virtual Público - Database Schema

-- 1. Nova Tabela: restaurant_settings
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Menu Público
  menu_enabled BOOLEAN DEFAULT false,
  slug TEXT UNIQUE NOT NULL,
  custom_domain TEXT,
  
  -- Branding
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT DEFAULT '#FF6B35',
  accent_color TEXT DEFAULT '#4ECDC4',
  
  -- Configurações de Pedido
  min_order_amount NUMERIC DEFAULT 0,
  max_delivery_distance_km INTEGER DEFAULT 10,
  estimated_prep_time_minutes INTEGER DEFAULT 30,
  
  -- Formas de Finalização
  checkout_whatsapp_enabled BOOLEAN DEFAULT true,
  checkout_web_enabled BOOLEAN DEFAULT false,
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT[],
  
  -- Social
  instagram_url TEXT,
  facebook_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para busca rápida por slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_settings_slug ON restaurant_settings(slug);

-- RLS Policies para restaurant_settings
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view enabled menus" ON restaurant_settings;
CREATE POLICY "Public can view enabled menus"
  ON restaurant_settings FOR SELECT
  USING (menu_enabled = true);

DROP POLICY IF EXISTS "Owners can manage their settings" ON restaurant_settings;
CREATE POLICY "Owners can manage their settings"
  ON restaurant_settings FOR ALL
  USING (user_has_restaurant_access(restaurant_id));

-- 2. Nova Tabela: web_orders
CREATE TABLE IF NOT EXISTS public.web_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  cart_id UUID NOT NULL REFERENCES carts(id),
  
  -- Dados do Cliente
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  
  -- Entrega
  delivery_address TEXT NOT NULL,
  delivery_lat NUMERIC,
  delivery_lng NUMERIC,
  delivery_instructions TEXT,
  
  -- Pedido
  items JSONB NOT NULL,
  subtotal NUMERIC NOT NULL,
  delivery_fee NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  
  -- Pagamento
  payment_method TEXT NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  
  -- Status
  status TEXT DEFAULT 'pending',
  
  -- Metadata
  source TEXT DEFAULT 'web',
  user_agent TEXT,
  ip_address INET,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para web_orders
CREATE INDEX IF NOT EXISTS idx_web_orders_restaurant ON web_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_web_orders_phone ON web_orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_web_orders_status ON web_orders(status);
CREATE INDEX IF NOT EXISTS idx_web_orders_created ON web_orders(created_at DESC);

-- RLS Policies para web_orders
ALTER TABLE web_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view their web orders" ON web_orders;
CREATE POLICY "Owners can view their web orders"
  ON web_orders FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));

DROP POLICY IF EXISTS "Service role can create web orders" ON web_orders;
CREATE POLICY "Service role can create web orders"
  ON web_orders FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can update their web orders" ON web_orders;
CREATE POLICY "Owners can update their web orders"
  ON web_orders FOR UPDATE
  USING (user_has_restaurant_access(restaurant_id));

-- 3. Trigger para updated_at em restaurant_settings
DROP TRIGGER IF EXISTS update_restaurant_settings_updated_at ON restaurant_settings;
CREATE TRIGGER update_restaurant_settings_updated_at
  BEFORE UPDATE ON restaurant_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Trigger para updated_at em web_orders
DROP TRIGGER IF EXISTS update_web_orders_updated_at ON web_orders;
CREATE TRIGGER update_web_orders_updated_at
  BEFORE UPDATE ON web_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Função para gerar slug único
CREATE OR REPLACE FUNCTION generate_unique_slug(restaurant_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Gerar slug base
  base_slug := LOWER(REGEXP_REPLACE(restaurant_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := TRIM(BOTH '-' FROM base_slug);
  final_slug := base_slug;
  
  -- Verificar se slug já existe e adicionar contador se necessário
  WHILE EXISTS (SELECT 1 FROM restaurant_settings WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- 6. Criar restaurant_settings para restaurantes existentes
INSERT INTO restaurant_settings (restaurant_id, slug, menu_enabled)
SELECT 
  id,
  generate_unique_slug(name),
  false
FROM restaurants
WHERE id NOT IN (SELECT restaurant_id FROM restaurant_settings);

-- 7. Adicionar constraint para garantir que slug não é nulo
ALTER TABLE restaurant_settings 
  ALTER COLUMN slug SET NOT NULL;