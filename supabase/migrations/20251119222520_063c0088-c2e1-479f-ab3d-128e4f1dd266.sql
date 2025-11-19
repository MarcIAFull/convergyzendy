-- Add indexes for better query performance on foreign keys and frequently queried columns

CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_addons_product_id ON addons(product_id);
CREATE INDEX IF NOT EXISTS idx_carts_restaurant_id ON carts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_carts_user_phone ON carts(user_phone);
CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_item_addons_cart_item_id ON cart_item_addons(cart_item_id);
CREATE INDEX IF NOT EXISTS idx_cart_item_addons_addon_id ON cart_item_addons(addon_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_cart_id ON orders(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_phone ON orders(user_phone);
CREATE INDEX IF NOT EXISTS idx_messages_restaurant_id ON messages(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);