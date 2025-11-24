-- Fix security warning: Function Search Path Mutable

DROP FUNCTION IF EXISTS generate_unique_slug(TEXT);

CREATE OR REPLACE FUNCTION generate_unique_slug(restaurant_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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