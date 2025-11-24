-- Fase 4: Geolocalização e Validação de Entregas

-- 1. Adicionar colunas de geolocalização à tabela restaurants
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric,
ADD COLUMN IF NOT EXISTS google_place_id text;

-- 2. Criar tabela delivery_zones
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  coordinates jsonb NOT NULL, -- Array de {lat, lng} para polígono
  fee_type text NOT NULL DEFAULT 'fixed', -- 'fixed', 'per_km', 'dynamic'
  fee_amount numeric NOT NULL DEFAULT 0,
  min_order_amount numeric DEFAULT 0,
  max_delivery_time_minutes integer DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0, -- Para resolver overlaps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index para performance
CREATE INDEX idx_delivery_zones_restaurant_id ON public.delivery_zones(restaurant_id);
CREATE INDEX idx_delivery_zones_active ON public.delivery_zones(is_active) WHERE is_active = true;

-- 3. Criar tabela address_cache (cache de geocoding)
CREATE TABLE IF NOT EXISTS public.address_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address_query text NOT NULL,
  formatted_address text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  google_place_id text,
  address_components jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days')
);

-- Index único para evitar duplicatas e melhorar performance
CREATE UNIQUE INDEX idx_address_cache_query ON public.address_cache(address_query);
CREATE INDEX idx_address_cache_expires ON public.address_cache(expires_at);

-- 4. Criar tabela distance_matrix_cache (cache de distâncias)
CREATE TABLE IF NOT EXISTS public.distance_matrix_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origin_lat numeric NOT NULL,
  origin_lng numeric NOT NULL,
  destination_lat numeric NOT NULL,
  destination_lng numeric NOT NULL,
  distance_meters integer NOT NULL,
  duration_seconds integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days')
);

-- Index composto para lookups rápidos
CREATE INDEX idx_distance_matrix_origins ON public.distance_matrix_cache(origin_lat, origin_lng);
CREATE INDEX idx_distance_matrix_cache_expires ON public.distance_matrix_cache(expires_at);

-- 5. Trigger para atualizar updated_at em delivery_zones
CREATE TRIGGER update_delivery_zones_updated_at
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RLS Policies para delivery_zones
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their restaurant delivery zones"
  ON public.delivery_zones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = delivery_zones.restaurant_id
      AND user_has_restaurant_access(restaurants.id)
    )
  );

CREATE POLICY "Users can manage their restaurant delivery zones"
  ON public.delivery_zones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = delivery_zones.restaurant_id
      AND user_has_restaurant_access(restaurants.id)
    )
  );

-- 7. RLS Policies para address_cache (público para leitura, service_role para escrita)
ALTER TABLE public.address_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read address cache"
  ON public.address_cache FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage address cache"
  ON public.address_cache FOR ALL
  USING (true);

-- 8. RLS Policies para distance_matrix_cache
ALTER TABLE public.distance_matrix_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read distance cache"
  ON public.distance_matrix_cache FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage distance cache"
  ON public.distance_matrix_cache FOR ALL
  USING (true);

-- 9. Função para limpar caches expirados (pode ser chamada via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_caches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.address_cache WHERE expires_at < now();
  DELETE FROM public.distance_matrix_cache WHERE expires_at < now();
END;
$$;