-- ========================================
-- MIGRATION: Separate customers and add pending items support
-- ========================================
-- This migration adds:
-- 1. customers table: separate customer data from carts
-- 2. conversation_pending_items table: support multiple pending products before cart
-- 3. carts.metadata: for order-level notes only
-- 4. orders.order_notes: copy order-level notes from cart.metadata
-- ========================================

-- Create customers table to store customer profile data
-- Links customers by phone number (same as conversation_state and carts)
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  name text,
  default_address jsonb,
  default_payment_method text CHECK (default_payment_method IN ('cash', 'card', 'mbway', 'multibanco')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS policies for customers (public access for now, matches existing pattern)
CREATE POLICY "Public can view customers" ON public.customers
  FOR SELECT USING (true);

CREATE POLICY "Public can insert customers" ON public.customers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update customers" ON public.customers
  FOR UPDATE USING (true);

CREATE POLICY "Public can delete customers" ON public.customers
  FOR DELETE USING (true);

-- Trigger for automatic updated_at timestamp
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create conversation_pending_items table
-- Holds products being discussed/confirmed before they enter the cart
-- Supports multiple pending items simultaneously per conversation
CREATE TABLE IF NOT EXISTS public.conversation_pending_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Using user_phone (not conversation_state_id) because:
  -- 1. Matches the pattern in carts table for consistency
  -- 2. More stable than conversation_state which can be reset
  -- 3. Simpler queries without extra joins
  user_phone text NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes text,
  -- Status: pending (under discussion), confirmed (added to cart), discarded (rejected)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'discarded')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on conversation_pending_items
ALTER TABLE public.conversation_pending_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for pending items
CREATE POLICY "Public can view pending items" ON public.conversation_pending_items
  FOR SELECT USING (true);

CREATE POLICY "Public can insert pending items" ON public.conversation_pending_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update pending items" ON public.conversation_pending_items
  FOR UPDATE USING (true);

CREATE POLICY "Public can delete pending items" ON public.conversation_pending_items
  FOR DELETE USING (true);

-- Trigger for automatic updated_at timestamp
CREATE TRIGGER update_pending_items_updated_at
  BEFORE UPDATE ON public.conversation_pending_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add metadata column to carts table for order-level notes
ALTER TABLE public.carts
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add order_notes column to orders table
-- Will hold order-level notes copied from cart.metadata.order_notes on order creation
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_notes text;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_pending_items_phone ON public.conversation_pending_items(user_phone);
CREATE INDEX IF NOT EXISTS idx_pending_items_status ON public.conversation_pending_items(status);
CREATE INDEX IF NOT EXISTS idx_pending_items_restaurant ON public.conversation_pending_items(restaurant_id);

-- Add helpful comments to document the schema
COMMENT ON TABLE public.customers IS 'Stores customer profile data separately from carts and conversations. Links customers by phone number. Future: migrate customer data from old sources here.';

COMMENT ON TABLE public.conversation_pending_items IS 'Holds products that are being discussed/confirmed before they enter the cart. Supports multiple pending items simultaneously. Uses user_phone instead of conversation_state_id for simplicity and persistence across conversation resets.';

COMMENT ON COLUMN public.conversation_pending_items.status IS 'Status of the pending item: pending (under discussion), confirmed (added to cart), discarded (rejected by user)';

COMMENT ON COLUMN public.conversation_pending_items.user_phone IS 'Using phone directly (not conversation_state_id) because: 1) Matches pattern in carts table, 2) More stable than conversation_state which can be reset, 3) Simpler queries';

COMMENT ON COLUMN public.carts.metadata IS 'Reserved for order-level notes only, e.g. {"order_notes": "leave at reception, don''t ring the bell"}. Customer profile data (name, address, payment) should be stored in customers table instead.';

COMMENT ON COLUMN public.orders.order_notes IS 'Order-level notes copied from cart.metadata.order_notes on order creation. Example: "leave at reception", "call when arriving"';