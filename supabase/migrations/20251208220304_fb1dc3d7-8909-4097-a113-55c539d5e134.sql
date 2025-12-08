-- Enable realtime for all critical tables
-- Set REPLICA IDENTITY FULL for complete row data during updates

-- Messages table (WhatsApp messages)
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Orders table
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Web orders table
ALTER TABLE public.web_orders REPLICA IDENTITY FULL;

-- Cart items table
ALTER TABLE public.cart_items REPLICA IDENTITY FULL;

-- Cart item addons table
ALTER TABLE public.cart_item_addons REPLICA IDENTITY FULL;

-- Carts table
ALTER TABLE public.carts REPLICA IDENTITY FULL;

-- Conversation state table
ALTER TABLE public.conversation_state REPLICA IDENTITY FULL;

-- Conversation mode table
ALTER TABLE public.conversation_mode REPLICA IDENTITY FULL;

-- Customers table
ALTER TABLE public.customers REPLICA IDENTITY FULL;

-- Conversation pending items
ALTER TABLE public.conversation_pending_items REPLICA IDENTITY FULL;

-- Products table (for menu updates)
ALTER TABLE public.products REPLICA IDENTITY FULL;

-- Categories table
ALTER TABLE public.categories REPLICA IDENTITY FULL;

-- WhatsApp instances table
ALTER TABLE public.whatsapp_instances REPLICA IDENTITY FULL;

-- Add all tables to the supabase_realtime publication
-- First check if publication exists, if not the tables are added individually
DO $$
BEGIN
  -- Try to add tables to supabase_realtime publication
  -- This may fail if publication doesn't exist, which is fine
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add messages to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add orders to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.web_orders;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add web_orders to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cart_items;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add cart_items to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cart_item_addons;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add cart_item_addons to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.carts;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add carts to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_state;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add conversation_state to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_mode;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add conversation_mode to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add customers to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_pending_items;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add conversation_pending_items to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add products to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add categories to publication: %', SQLERRM;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instances;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add whatsapp_instances to publication: %', SQLERRM;
  END;
END $$;