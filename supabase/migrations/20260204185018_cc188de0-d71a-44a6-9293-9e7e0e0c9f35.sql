-- Configuração de integração Glovo por restaurante
CREATE TABLE public.restaurant_glovo_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  address_book_id UUID,
  pickup_address TEXT,
  pickup_latitude DECIMAL(10,7),
  pickup_longitude DECIMAL(10,7),
  pickup_phone TEXT,
  webhook_secret TEXT,
  environment TEXT DEFAULT 'staging' CHECK (environment IN ('staging', 'production')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entregas Glovo
CREATE TABLE public.glovo_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  order_code TEXT,
  quote_id UUID,
  quote_price DECIMAL(10,2),
  final_fee DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'CREATED',
  courier_name TEXT,
  courier_phone TEXT,
  courier_latitude DECIMAL(10,7),
  courier_longitude DECIMAL(10,7),
  tracking_link TEXT,
  estimated_pickup_at TIMESTAMPTZ,
  estimated_delivery_at TIMESTAMPTZ,
  picked_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_glovo_deliveries_order_id ON public.glovo_deliveries(order_id);
CREATE INDEX idx_glovo_deliveries_tracking ON public.glovo_deliveries(tracking_number);
CREATE INDEX idx_glovo_deliveries_status ON public.glovo_deliveries(status);

-- Adicionar campo na tabela orders para indicar método de entrega
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_provider TEXT DEFAULT 'restaurant' 
  CHECK (delivery_provider IN ('restaurant', 'glovo', 'other'));

-- RLS para restaurant_glovo_config
ALTER TABLE public.restaurant_glovo_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their restaurant glovo config" ON public.restaurant_glovo_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_owners ro
      WHERE ro.restaurant_id = restaurant_glovo_config.restaurant_id
        AND ro.user_id = auth.uid()
    )
  );

-- RLS para glovo_deliveries
ALTER TABLE public.glovo_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their deliveries" ON public.glovo_deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_owners ro
      WHERE ro.restaurant_id = glovo_deliveries.restaurant_id
        AND ro.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert deliveries for their restaurants" ON public.glovo_deliveries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_owners ro
      WHERE ro.restaurant_id = glovo_deliveries.restaurant_id
        AND ro.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update deliveries for their restaurants" ON public.glovo_deliveries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_owners ro
      WHERE ro.restaurant_id = glovo_deliveries.restaurant_id
        AND ro.user_id = auth.uid()
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_restaurant_glovo_config_updated_at
  BEFORE UPDATE ON public.restaurant_glovo_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_glovo_deliveries_updated_at
  BEFORE UPDATE ON public.glovo_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();