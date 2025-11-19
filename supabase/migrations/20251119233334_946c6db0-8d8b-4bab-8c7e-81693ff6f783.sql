-- Remove authentication requirements for MVP single-tenant mode

-- Drop all existing RLS policies that require authentication
DROP POLICY IF EXISTS "Users can view their own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Users can insert their own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Users can update their own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Users can delete their own restaurant" ON public.restaurants;

DROP POLICY IF EXISTS "Restaurant owners can view their categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can update their categories" ON public.categories;
DROP POLICY IF EXISTS "Restaurant owners can delete their categories" ON public.categories;

DROP POLICY IF EXISTS "Restaurant owners can view their products" ON public.products;
DROP POLICY IF EXISTS "Restaurant owners can insert products" ON public.products;
DROP POLICY IF EXISTS "Restaurant owners can update their products" ON public.products;
DROP POLICY IF EXISTS "Restaurant owners can delete their products" ON public.products;

DROP POLICY IF EXISTS "Restaurant owners can view their addons" ON public.addons;
DROP POLICY IF EXISTS "Restaurant owners can insert addons" ON public.addons;
DROP POLICY IF EXISTS "Restaurant owners can update their addons" ON public.addons;
DROP POLICY IF EXISTS "Restaurant owners can delete their addons" ON public.addons;

DROP POLICY IF EXISTS "Restaurant owners can view their orders" ON public.orders;
DROP POLICY IF EXISTS "Restaurant owners can update their orders" ON public.orders;

DROP POLICY IF EXISTS "Restaurant owners can view their messages" ON public.messages;

-- Make user_id nullable in restaurants table for single-tenant mode
ALTER TABLE public.restaurants ALTER COLUMN user_id DROP NOT NULL;

-- Create permissive policies that allow anyone to access everything (MVP single-tenant mode)

-- Restaurants: Full public access
CREATE POLICY "Public can view restaurants"
ON public.restaurants FOR SELECT
USING (true);

CREATE POLICY "Public can insert restaurants"
ON public.restaurants FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can update restaurants"
ON public.restaurants FOR UPDATE
USING (true);

CREATE POLICY "Public can delete restaurants"
ON public.restaurants FOR DELETE
USING (true);

-- Categories: Full public access
CREATE POLICY "Public can view categories"
ON public.categories FOR SELECT
USING (true);

CREATE POLICY "Public can insert categories"
ON public.categories FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can update categories"
ON public.categories FOR UPDATE
USING (true);

CREATE POLICY "Public can delete categories"
ON public.categories FOR DELETE
USING (true);

-- Products: Full public access
CREATE POLICY "Public can view products"
ON public.products FOR SELECT
USING (true);

CREATE POLICY "Public can insert products"
ON public.products FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can update products"
ON public.products FOR UPDATE
USING (true);

CREATE POLICY "Public can delete products"
ON public.products FOR DELETE
USING (true);

-- Addons: Full public access
CREATE POLICY "Public can view addons"
ON public.addons FOR SELECT
USING (true);

CREATE POLICY "Public can insert addons"
ON public.addons FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can update addons"
ON public.addons FOR UPDATE
USING (true);

CREATE POLICY "Public can delete addons"
ON public.addons FOR DELETE
USING (true);

-- Orders: Full public access
CREATE POLICY "Public can view orders"
ON public.orders FOR SELECT
USING (true);

CREATE POLICY "Public can update orders"
ON public.orders FOR UPDATE
USING (true);

CREATE POLICY "Public can delete orders"
ON public.orders FOR DELETE
USING (true);

-- Messages: Full public access
CREATE POLICY "Public can view messages"
ON public.messages FOR SELECT
USING (true);

CREATE POLICY "Public can update messages"
ON public.messages FOR UPDATE
USING (true);

CREATE POLICY "Public can delete messages"
ON public.messages FOR DELETE
USING (true);

-- Storage bucket policies for product-images
-- Drop existing policies
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete product images" ON storage.objects;

-- Create permissive storage policies
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Public can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Public can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

CREATE POLICY "Public can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');