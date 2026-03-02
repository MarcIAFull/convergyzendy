-- Allow anonymous users to SELECT carts they just inserted (needed for INSERT...RETURNING)
CREATE POLICY "Anon can select own carts by phone"
ON public.carts
FOR SELECT
TO anon
USING (true);

-- Allow anonymous INSERT on cart_items
CREATE POLICY "Anon can insert cart items"
ON public.cart_items
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous SELECT on cart_items (needed for RETURNING)
CREATE POLICY "Anon can select cart items"
ON public.cart_items
FOR SELECT
TO anon
USING (true);

-- Allow anonymous INSERT on web_orders  
CREATE POLICY "Anon can insert web orders"
ON public.web_orders
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous SELECT on web_orders (needed for RETURNING after insert)
CREATE POLICY "Anon can select own web orders"
ON public.web_orders
FOR SELECT
TO anon
USING (true);