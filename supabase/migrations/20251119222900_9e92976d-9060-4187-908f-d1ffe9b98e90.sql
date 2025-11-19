-- Enable realtime for orders table
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Enable realtime for cart_items and related tables for full order details
ALTER TABLE cart_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE cart_items;

ALTER TABLE cart_item_addons REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE cart_item_addons;