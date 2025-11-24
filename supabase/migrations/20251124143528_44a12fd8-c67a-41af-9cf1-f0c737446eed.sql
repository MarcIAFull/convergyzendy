
-- ================================================
-- PUBLIC MENU: Add RLS policies for public access
-- ================================================

-- Policy: Public can view restaurants with enabled menus
DROP POLICY IF EXISTS "Public can view restaurants with enabled menus" ON public.restaurants;
CREATE POLICY "Public can view restaurants with enabled menus"
ON public.restaurants FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.restaurant_settings 
    WHERE restaurant_settings.restaurant_id = restaurants.id 
      AND restaurant_settings.menu_enabled = true
  )
);

-- Policy: Public can view categories from enabled menus
DROP POLICY IF EXISTS "Public can view categories from enabled menus" ON public.categories;
CREATE POLICY "Public can view categories from enabled menus"
ON public.categories FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.restaurant_settings 
    WHERE restaurant_settings.restaurant_id = categories.restaurant_id 
      AND restaurant_settings.menu_enabled = true
  )
);

-- Policy: Public can view available products from enabled menus
DROP POLICY IF EXISTS "Public can view products from enabled menus" ON public.products;
CREATE POLICY "Public can view products from enabled menus"
ON public.products FOR SELECT
USING (
  is_available = true
  AND EXISTS (
    SELECT 1 
    FROM public.restaurant_settings 
    WHERE restaurant_settings.restaurant_id = products.restaurant_id 
      AND restaurant_settings.menu_enabled = true
  )
);

-- Policy: Public can view addons from enabled menu products
DROP POLICY IF EXISTS "Public can view addons from enabled menus" ON public.addons;
CREATE POLICY "Public can view addons from enabled menus"
ON public.addons FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.products
    JOIN public.restaurant_settings ON restaurant_settings.restaurant_id = products.restaurant_id
    WHERE products.id = addons.product_id 
      AND restaurant_settings.menu_enabled = true
  )
);
