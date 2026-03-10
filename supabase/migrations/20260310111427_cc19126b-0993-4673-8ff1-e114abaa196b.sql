
-- Create addon_groups table
CREATE TABLE public.addon_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  min_selections INTEGER DEFAULT 0,
  max_selections INTEGER,
  free_selections INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add group_id column to addons (nullable for backwards compatibility)
ALTER TABLE public.addons ADD COLUMN group_id UUID REFERENCES public.addon_groups(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.addon_groups ENABLE ROW LEVEL SECURITY;

-- RLS: Public can view addon_groups from enabled menus
CREATE POLICY "Public can view addon_groups from enabled menus"
ON public.addon_groups
FOR SELECT
TO public
USING (EXISTS (
  SELECT 1
  FROM products
  JOIN restaurant_settings ON restaurant_settings.restaurant_id = products.restaurant_id
  WHERE products.id = addon_groups.product_id
  AND restaurant_settings.menu_enabled = true
));

-- RLS: Authenticated users can view their restaurant addon_groups
CREATE POLICY "Users can view their restaurant addon_groups"
ON public.addon_groups
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM products
  WHERE products.id = addon_groups.product_id
  AND user_has_restaurant_access(products.restaurant_id)
));

-- RLS: Authenticated users can manage their restaurant addon_groups
CREATE POLICY "Users can manage their restaurant addon_groups"
ON public.addon_groups
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM products
  WHERE products.id = addon_groups.product_id
  AND user_has_restaurant_access(products.restaurant_id)
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM products
  WHERE products.id = addon_groups.product_id
  AND user_has_restaurant_access(products.restaurant_id)
));

-- Add updated_at trigger
CREATE TRIGGER update_addon_groups_updated_at
  BEFORE UPDATE ON public.addon_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
