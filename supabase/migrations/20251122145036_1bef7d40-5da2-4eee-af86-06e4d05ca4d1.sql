-- =====================================================
-- COMPLETE RLS FIX AND OPTIMIZATION MIGRATION
-- PHASE 1: Immediate RLS Fix
-- PHASE 2: Structural Correction (Customers)
-- PHASE 3: Security & Performance Optimization
-- =====================================================

-- =====================================================
-- PHASE 1: IMMEDIATE RLS FIX FOR RESTAURANTS
-- =====================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Users can update their own restaurants" ON public.restaurants;

-- Create simplified policies that use restaurant_owners directly
CREATE POLICY "Users can view their restaurants"
ON public.restaurants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_owners
    WHERE restaurant_owners.restaurant_id = restaurants.id
      AND restaurant_owners.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their restaurants"
ON public.restaurants
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_owners
    WHERE restaurant_owners.restaurant_id = restaurants.id
      AND restaurant_owners.user_id = auth.uid()
  )
);

-- =====================================================
-- PHASE 2: STRUCTURAL CORRECTION - ADD RESTAURANT_ID TO CUSTOMERS
-- =====================================================

-- Add restaurant_id column to customers (nullable initially for migration)
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS restaurant_id UUID;

-- Populate restaurant_id for existing customers based on their orders
UPDATE public.customers c
SET restaurant_id = (
  SELECT o.restaurant_id 
  FROM public.orders o 
  WHERE o.user_phone = c.phone 
  ORDER BY o.created_at DESC 
  LIMIT 1
)
WHERE c.restaurant_id IS NULL;

-- For any remaining customers without orders, set to first available restaurant
UPDATE public.customers c
SET restaurant_id = (
  SELECT id FROM public.restaurants LIMIT 1
)
WHERE c.restaurant_id IS NULL;

-- Now make restaurant_id NOT NULL
ALTER TABLE public.customers 
ALTER COLUMN restaurant_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.customers
ADD CONSTRAINT customers_restaurant_id_fkey 
FOREIGN KEY (restaurant_id) 
REFERENCES public.restaurants(id) 
ON DELETE CASCADE;

-- Drop old complex policies for customers
DROP POLICY IF EXISTS "Users can view customers who ordered from their restaurant" ON public.customers;
DROP POLICY IF EXISTS "Webhooks can manage customers" ON public.customers;

-- Create new simplified policies for customers
CREATE POLICY "Users can view their restaurant customers"
ON public.customers
FOR SELECT
TO authenticated
USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can insert customers for their restaurant"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can update their restaurant customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Service role can manage all customers"
ON public.customers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Simplify addons policies to avoid complex joins
DROP POLICY IF EXISTS "Users can manage their restaurant addons" ON public.addons;
DROP POLICY IF EXISTS "Users can view their restaurant addons" ON public.addons;

CREATE POLICY "Users can view their restaurant addons"
ON public.addons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = addons.product_id
      AND user_has_restaurant_access(products.restaurant_id)
  )
);

CREATE POLICY "Users can insert addons for their products"
ON public.addons
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = addons.product_id
      AND user_has_restaurant_access(products.restaurant_id)
  )
);

CREATE POLICY "Users can update their restaurant addons"
ON public.addons
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = addons.product_id
      AND user_has_restaurant_access(products.restaurant_id)
  )
);

CREATE POLICY "Users can delete their restaurant addons"
ON public.addons
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = addons.product_id
      AND user_has_restaurant_access(products.restaurant_id)
  )
);

-- =====================================================
-- PHASE 3: SECURITY & PERFORMANCE OPTIMIZATION
-- =====================================================

-- Create compound indexes for better performance
CREATE INDEX IF NOT EXISTS idx_restaurant_owners_user_restaurant 
ON public.restaurant_owners(user_id, restaurant_id);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status 
ON public.orders(restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_products_restaurant 
ON public.products(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_customers_restaurant 
ON public.customers(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created 
ON public.orders(restaurant_id, created_at DESC);

-- Improve user_has_restaurant_access function with better performance attributes
CREATE OR REPLACE FUNCTION public.user_has_restaurant_access(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
PARALLEL SAFE
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_owners
    WHERE user_id = auth.uid()
      AND restaurant_id = _restaurant_id
  )
$function$;

-- Add helpful comments
COMMENT ON FUNCTION public.user_has_restaurant_access IS 
'Security definer function to check if the current user has access to a restaurant. Used in RLS policies to prevent infinite recursion.';

COMMENT ON TABLE public.customers IS 
'Stores customer information with restaurant association for proper data isolation';

COMMENT ON COLUMN public.customers.restaurant_id IS 
'Links customer to their restaurant for proper RLS and data isolation';

COMMENT ON INDEX idx_restaurant_owners_user_restaurant IS 
'Optimizes restaurant access checks in RLS policies';

COMMENT ON INDEX idx_orders_restaurant_status IS 
'Optimizes order queries filtered by restaurant and status';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================