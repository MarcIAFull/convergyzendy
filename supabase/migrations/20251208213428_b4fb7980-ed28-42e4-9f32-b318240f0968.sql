-- Remove duplicate restaurant_settings, keeping the most recent one
DELETE FROM public.restaurant_settings a
USING public.restaurant_settings b
WHERE a.restaurant_id = b.restaurant_id
  AND a.created_at < b.created_at;

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.restaurant_settings
ADD CONSTRAINT restaurant_settings_restaurant_id_unique UNIQUE (restaurant_id);