-- Garantir que todos os restaurantes têm restaurant_settings
INSERT INTO restaurant_settings (
  restaurant_id,
  slug,
  menu_enabled,
  primary_color,
  accent_color,
  min_order_amount,
  max_delivery_distance_km,
  estimated_prep_time_minutes,
  checkout_whatsapp_enabled,
  checkout_web_enabled
)
SELECT
  r.id,
  generate_unique_slug(r.name),
  false,
  '#3b82f6',
  '#10b981',
  10,
  10,
  30,
  true,
  false
FROM restaurants r
WHERE NOT EXISTS (
  SELECT 1 FROM restaurant_settings rs WHERE rs.restaurant_id = r.id
);

-- Criar bucket para assets do restaurante (logo, banner)
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-assets', 'restaurant-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Restaurant owners can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can update their assets" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can delete their assets" ON storage.objects;
DROP POLICY IF EXISTS "Public assets are viewable by everyone" ON storage.objects;

-- RLS: Permitir que donos do restaurante façam upload de assets
CREATE POLICY "Restaurant owners can upload assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'restaurant-assets' AND
  auth.uid() IN (
    SELECT r.user_id 
    FROM restaurants r
    WHERE r.id::text = (storage.foldername(name))[1]
  )
);

-- RLS: Permitir que donos do restaurante atualizem seus assets
CREATE POLICY "Restaurant owners can update their assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'restaurant-assets' AND
  auth.uid() IN (
    SELECT r.user_id 
    FROM restaurants r
    WHERE r.id::text = (storage.foldername(name))[1]
  )
);

-- RLS: Permitir que donos do restaurante deletem seus assets
CREATE POLICY "Restaurant owners can delete their assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'restaurant-assets' AND
  auth.uid() IN (
    SELECT r.user_id 
    FROM restaurants r
    WHERE r.id::text = (storage.foldername(name))[1]
  )
);

-- RLS: Todos podem ver os assets (bucket público)
CREATE POLICY "Public assets are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-assets');