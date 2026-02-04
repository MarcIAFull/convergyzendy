-- Configuração ZoneSoft por restaurante
CREATE TABLE public.restaurant_zonesoft_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  
  -- Credenciais API
  client_id TEXT,              -- X-ZS-CLIENT-ID
  app_key TEXT,                -- X-ZS-APP-KEY
  app_secret TEXT,             -- Para gerar X-ZS-SIGNATURE
  
  -- Configuração da Loja
  store_id INTEGER,            -- loja no ZoneSoft
  warehouse_id INTEGER DEFAULT 1, -- armazem padrão
  operator_id INTEGER,         -- empid (operador)
  document_type TEXT DEFAULT 'TK',  -- Tipo de documento (TK=Ticket, VD=Venda, etc)
  document_series TEXT,        -- Série do documento (ex: W2024L5)
  payment_type_id INTEGER DEFAULT 1, -- Tipo de pagamento padrão
  
  -- Mapeamento
  products_synced_at TIMESTAMPTZ,
  sync_mode TEXT DEFAULT 'manual' CHECK (sync_mode IN ('manual', 'auto')),
  
  -- Metadados
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mapeamento de produtos (nosso sistema -> ZoneSoft)
CREATE TABLE public.zonesoft_product_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  local_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  zonesoft_product_id INTEGER NOT NULL,
  zonesoft_product_code TEXT,
  zonesoft_product_name TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, local_product_id)
);

-- Log de sincronizações ZoneSoft
CREATE TABLE public.zonesoft_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'send_order', 'sync_products', 'get_document'
  status TEXT NOT NULL, -- 'success', 'error', 'pending'
  zonesoft_document_number INTEGER,
  zonesoft_document_type TEXT,
  zonesoft_document_series TEXT,
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_zonesoft_product_mapping_restaurant ON public.zonesoft_product_mapping(restaurant_id);
CREATE INDEX idx_zonesoft_product_mapping_local ON public.zonesoft_product_mapping(local_product_id);
CREATE INDEX idx_zonesoft_sync_logs_order ON public.zonesoft_sync_logs(order_id);
CREATE INDEX idx_zonesoft_sync_logs_restaurant ON public.zonesoft_sync_logs(restaurant_id);

-- Adicionar campos na orders para tracking ZoneSoft
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zonesoft_document_number INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zonesoft_document_type TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zonesoft_document_series TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zonesoft_synced_at TIMESTAMPTZ;

-- RLS para restaurant_zonesoft_config
ALTER TABLE public.restaurant_zonesoft_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their restaurant zonesoft config" ON public.restaurant_zonesoft_config
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.restaurant_owners ro
    WHERE ro.restaurant_id = restaurant_zonesoft_config.restaurant_id 
    AND ro.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their restaurant zonesoft config" ON public.restaurant_zonesoft_config
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.restaurant_owners ro
    WHERE ro.restaurant_id = restaurant_zonesoft_config.restaurant_id 
    AND ro.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their restaurant zonesoft config" ON public.restaurant_zonesoft_config
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.restaurant_owners ro
    WHERE ro.restaurant_id = restaurant_zonesoft_config.restaurant_id 
    AND ro.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their restaurant zonesoft config" ON public.restaurant_zonesoft_config
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.restaurant_owners ro
    WHERE ro.restaurant_id = restaurant_zonesoft_config.restaurant_id 
    AND ro.user_id = auth.uid()
  ));

-- RLS para zonesoft_product_mapping
ALTER TABLE public.zonesoft_product_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage product mappings" ON public.zonesoft_product_mapping
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.restaurant_owners ro
    WHERE ro.restaurant_id = zonesoft_product_mapping.restaurant_id 
    AND ro.user_id = auth.uid()
  ));

-- RLS para zonesoft_sync_logs
ALTER TABLE public.zonesoft_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync logs" ON public.zonesoft_sync_logs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.restaurant_owners ro
    WHERE ro.restaurant_id = zonesoft_sync_logs.restaurant_id 
    AND ro.user_id = auth.uid()
  ));

CREATE POLICY "Service role can insert sync logs" ON public.zonesoft_sync_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update sync logs" ON public.zonesoft_sync_logs
  FOR UPDATE USING (true);