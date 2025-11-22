-- ============================================
-- PHASE 1: Multi-Tenant Foundation
-- ============================================

-- Step 1: Create restaurant_owners mapping table
CREATE TABLE IF NOT EXISTS public.restaurant_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'staff')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id)
);

-- Enable RLS on restaurant_owners
ALTER TABLE public.restaurant_owners ENABLE ROW LEVEL SECURITY;

-- Users can view their own restaurant associations
CREATE POLICY "Users can view their own restaurant associations"
  ON public.restaurant_owners FOR SELECT
  USING (auth.uid() = user_id);

-- Users can manage their own associations (for future multi-restaurant support)
CREATE POLICY "Users can manage their own associations"
  ON public.restaurant_owners FOR ALL
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_owners_user_id ON public.restaurant_owners(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_owners_restaurant_id ON public.restaurant_owners(restaurant_id);

-- Step 2: Create helper function for RLS checks
CREATE OR REPLACE FUNCTION public.user_has_restaurant_access(_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_owners
    WHERE user_id = auth.uid()
      AND restaurant_id = _restaurant_id
  )
$$;

-- Step 3: Update RLS policies for restaurants table
DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public can insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public can update restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public can delete restaurants" ON public.restaurants;

CREATE POLICY "Users can view their own restaurants"
  ON public.restaurants FOR SELECT
  USING (public.user_has_restaurant_access(id));

CREATE POLICY "Users can update their own restaurants"
  ON public.restaurants FOR UPDATE
  USING (public.user_has_restaurant_access(id));

CREATE POLICY "Authenticated users can create restaurants"
  ON public.restaurants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own restaurants"
  ON public.restaurants FOR DELETE
  USING (public.user_has_restaurant_access(id));

-- Step 4: Update RLS for categories
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
DROP POLICY IF EXISTS "Public can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Public can update categories" ON public.categories;
DROP POLICY IF EXISTS "Public can delete categories" ON public.categories;

CREATE POLICY "Users can view their restaurant categories"
  ON public.categories FOR SELECT
  USING (public.user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can manage their restaurant categories"
  ON public.categories FOR ALL
  USING (public.user_has_restaurant_access(restaurant_id));

-- Step 5: Update RLS for products
DROP POLICY IF EXISTS "Public can view products" ON public.products;
DROP POLICY IF EXISTS "Public can insert products" ON public.products;
DROP POLICY IF EXISTS "Public can update products" ON public.products;
DROP POLICY IF EXISTS "Public can delete products" ON public.products;

CREATE POLICY "Users can view their restaurant products"
  ON public.products FOR SELECT
  USING (public.user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can manage their restaurant products"
  ON public.products FOR ALL
  USING (public.user_has_restaurant_access(restaurant_id));

-- Step 6: Update RLS for addons
DROP POLICY IF EXISTS "Public can view addons" ON public.addons;
DROP POLICY IF EXISTS "Public can insert addons" ON public.addons;
DROP POLICY IF EXISTS "Public can update addons" ON public.addons;
DROP POLICY IF EXISTS "Public can delete addons" ON public.addons;

CREATE POLICY "Users can view their restaurant addons"
  ON public.addons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = addons.product_id
        AND public.user_has_restaurant_access(products.restaurant_id)
    )
  );

CREATE POLICY "Users can manage their restaurant addons"
  ON public.addons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = addons.product_id
        AND public.user_has_restaurant_access(products.restaurant_id)
    )
  );

-- Step 7: Update RLS for orders
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Public can update orders" ON public.orders;
DROP POLICY IF EXISTS "Public can delete orders" ON public.orders;

CREATE POLICY "Users can view their restaurant orders"
  ON public.orders FOR SELECT
  USING (public.user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can manage their restaurant orders"
  ON public.orders FOR ALL
  USING (public.user_has_restaurant_access(restaurant_id));

-- Allow unauthenticated inserts for WhatsApp bot orders (webhook)
CREATE POLICY "Webhooks can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

-- Step 8: Update RLS for carts
DROP POLICY IF EXISTS "Anyone can view carts" ON public.carts;
DROP POLICY IF EXISTS "Anyone can insert carts" ON public.carts;
DROP POLICY IF EXISTS "Anyone can update carts" ON public.carts;

CREATE POLICY "Users can view their restaurant carts"
  ON public.carts FOR SELECT
  USING (public.user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can manage their restaurant carts"
  ON public.carts FOR UPDATE
  USING (public.user_has_restaurant_access(restaurant_id));

-- Allow unauthenticated inserts for WhatsApp bot (webhook)
CREATE POLICY "Webhooks can insert carts"
  ON public.carts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Webhooks can update carts"
  ON public.carts FOR UPDATE
  USING (true);

-- Step 9: Update RLS for cart_items
DROP POLICY IF EXISTS "Anyone can view cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Anyone can insert cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Anyone can update cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Anyone can delete cart items" ON public.cart_items;

CREATE POLICY "Users can view their restaurant cart items"
  ON public.cart_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
        AND public.user_has_restaurant_access(carts.restaurant_id)
    )
  );

-- Allow webhooks full access for bot operations
CREATE POLICY "Webhooks can manage cart items"
  ON public.cart_items FOR ALL
  USING (true);

-- Step 10: Update RLS for cart_item_addons
DROP POLICY IF EXISTS "Anyone can view cart item addons" ON public.cart_item_addons;
DROP POLICY IF EXISTS "Anyone can insert cart item addons" ON public.cart_item_addons;
DROP POLICY IF EXISTS "Anyone can delete cart item addons" ON public.cart_item_addons;

CREATE POLICY "Users can view their restaurant cart item addons"
  ON public.cart_item_addons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cart_items
      JOIN public.carts ON carts.id = cart_items.cart_id
      WHERE cart_items.id = cart_item_addons.cart_item_id
        AND public.user_has_restaurant_access(carts.restaurant_id)
    )
  );

-- Allow webhooks full access
CREATE POLICY "Webhooks can manage cart item addons"
  ON public.cart_item_addons FOR ALL
  USING (true);

-- Step 11: Update RLS for messages
DROP POLICY IF EXISTS "Public can view messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Public can update messages" ON public.messages;
DROP POLICY IF EXISTS "Public can delete messages" ON public.messages;

CREATE POLICY "Users can view their restaurant messages"
  ON public.messages FOR SELECT
  USING (public.user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can manage their restaurant messages"
  ON public.messages FOR UPDATE
  USING (public.user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can delete their restaurant messages"
  ON public.messages FOR DELETE
  USING (public.user_has_restaurant_access(restaurant_id));

-- Allow webhooks to insert messages
CREATE POLICY "Webhooks can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (true);

-- Step 12: Update RLS for conversation_state
DROP POLICY IF EXISTS "Public can view conversation state" ON public.conversation_state;
DROP POLICY IF EXISTS "Public can insert conversation state" ON public.conversation_state;
DROP POLICY IF EXISTS "Public can update conversation state" ON public.conversation_state;
DROP POLICY IF EXISTS "Public can delete conversation state" ON public.conversation_state;

CREATE POLICY "Users can view their restaurant conversation state"
  ON public.conversation_state FOR SELECT
  USING (public.user_has_restaurant_access(restaurant_id));

-- Allow webhooks full access for bot operations
CREATE POLICY "Webhooks can manage conversation state"
  ON public.conversation_state FOR ALL
  USING (true);

-- Step 13: Update RLS for customers
DROP POLICY IF EXISTS "Public can view customers" ON public.customers;
DROP POLICY IF EXISTS "Public can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Public can update customers" ON public.customers;
DROP POLICY IF EXISTS "Public can delete customers" ON public.customers;

CREATE POLICY "Users can view customers who ordered from their restaurant"
  ON public.customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.user_phone = customers.phone
        AND public.user_has_restaurant_access(orders.restaurant_id)
    )
  );

-- Allow webhooks to manage customers
CREATE POLICY "Webhooks can manage customers"
  ON public.customers FOR ALL
  USING (true);

-- Step 14: Update RLS for customer_insights
DROP POLICY IF EXISTS "Public can view customer insights" ON public.customer_insights;
DROP POLICY IF EXISTS "Public can insert customer insights" ON public.customer_insights;
DROP POLICY IF EXISTS "Public can update customer insights" ON public.customer_insights;
DROP POLICY IF EXISTS "Public can delete customer insights" ON public.customer_insights;

CREATE POLICY "Users can view customer insights for their restaurant"
  ON public.customer_insights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.user_phone = customer_insights.phone
        AND public.user_has_restaurant_access(orders.restaurant_id)
    )
  );

-- Allow webhooks to manage insights
CREATE POLICY "Webhooks can manage customer insights"
  ON public.customer_insights FOR ALL
  USING (true);

-- Step 15: Keep agents global (shared across all restaurants for now)
-- No changes needed - current public policies are fine for shared resources

-- Step 16: Keep agent_prompt_blocks global
-- No changes needed

-- Step 17: Keep agent_tools global
-- No changes needed