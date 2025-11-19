-- Create restaurants table
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  opening_hours JSONB DEFAULT '{"monday": {"open": "09:00", "close": "22:00"}, "tuesday": {"open": "09:00", "close": "22:00"}, "wednesday": {"open": "09:00", "close": "22:00"}, "thursday": {"open": "09:00", "close": "22:00"}, "friday": {"open": "09:00", "close": "22:00"}, "saturday": {"open": "09:00", "close": "22:00"}, "sunday": {"open": "09:00", "close": "22:00"}}'::jsonb,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create addons table
CREATE TABLE public.addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create carts table
CREATE TABLE public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cart_items table
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cart_item_addons junction table
CREATE TABLE public.cart_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_item_id UUID NOT NULL REFERENCES public.cart_items(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_phone TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mbway', 'multibanco')),
  delivery_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'preparing', 'out_for_delivery', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurants
CREATE POLICY "Users can view their own restaurant"
  ON public.restaurants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own restaurant"
  ON public.restaurants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own restaurant"
  ON public.restaurants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own restaurant"
  ON public.restaurants FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for categories
CREATE POLICY "Restaurant owners can view their categories"
  ON public.categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = categories.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can insert categories"
  ON public.categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can update their categories"
  ON public.categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = categories.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can delete their categories"
  ON public.categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = categories.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- RLS Policies for products
CREATE POLICY "Restaurant owners can view their products"
  ON public.products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = products.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can insert products"
  ON public.products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can update their products"
  ON public.products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = products.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can delete their products"
  ON public.products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = products.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- RLS Policies for addons
CREATE POLICY "Restaurant owners can view their addons"
  ON public.addons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      JOIN public.restaurants ON restaurants.id = products.restaurant_id
      WHERE products.id = addons.product_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can insert addons"
  ON public.addons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products
      JOIN public.restaurants ON restaurants.id = products.restaurant_id
      WHERE products.id = product_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can update their addons"
  ON public.addons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      JOIN public.restaurants ON restaurants.id = products.restaurant_id
      WHERE products.id = addons.product_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owners can delete their addons"
  ON public.addons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      JOIN public.restaurants ON restaurants.id = products.restaurant_id
      WHERE products.id = addons.product_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- RLS Policies for carts (public access for WhatsApp ordering)
CREATE POLICY "Anyone can view carts"
  ON public.carts FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert carts"
  ON public.carts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update carts"
  ON public.carts FOR UPDATE
  USING (true);

-- RLS Policies for cart_items (public access)
CREATE POLICY "Anyone can view cart items"
  ON public.cart_items FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert cart items"
  ON public.cart_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update cart items"
  ON public.cart_items FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete cart items"
  ON public.cart_items FOR DELETE
  USING (true);

-- RLS Policies for cart_item_addons (public access)
CREATE POLICY "Anyone can view cart item addons"
  ON public.cart_item_addons FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert cart item addons"
  ON public.cart_item_addons FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete cart item addons"
  ON public.cart_item_addons FOR DELETE
  USING (true);

-- RLS Policies for orders
CREATE POLICY "Restaurant owners can view their orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = orders.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Restaurant owners can update their orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = orders.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- RLS Policies for messages
CREATE POLICY "Restaurant owners can view their messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = messages.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_restaurants_user_id ON public.restaurants(user_id);
CREATE INDEX idx_categories_restaurant_id ON public.categories(restaurant_id);
CREATE INDEX idx_products_restaurant_id ON public.products(restaurant_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_addons_product_id ON public.addons(product_id);
CREATE INDEX idx_carts_restaurant_id ON public.carts(restaurant_id);
CREATE INDEX idx_carts_user_phone ON public.carts(user_phone);
CREATE INDEX idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX idx_cart_item_addons_cart_item_id ON public.cart_item_addons(cart_item_id);
CREATE INDEX idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_messages_restaurant_id ON public.messages(restaurant_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_addons_updated_at
  BEFORE UPDATE ON public.addons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_carts_updated_at
  BEFORE UPDATE ON public.carts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();