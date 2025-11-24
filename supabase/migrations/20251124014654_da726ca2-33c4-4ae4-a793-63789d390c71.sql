-- =====================================================
-- PENDING ITEMS TABLE FOR MULTI-ITEM WORKFLOW
-- =====================================================

-- Create conversation_pending_items table
CREATE TABLE IF NOT EXISTS public.conversation_pending_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  addon_ids TEXT[] DEFAULT '{}',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'discarded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversation_pending_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for pending items
CREATE POLICY "Users can view their own pending items"
  ON public.conversation_pending_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = conversation_pending_items.restaurant_id
        AND user_has_restaurant_access(restaurants.id)
    )
  );

CREATE POLICY "Service role can manage all pending items"
  ON public.conversation_pending_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_pending_items_updated_at
  BEFORE UPDATE ON public.conversation_pending_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_pending_items_user_phone ON public.conversation_pending_items(user_phone);
CREATE INDEX idx_pending_items_restaurant_id ON public.conversation_pending_items(restaurant_id);
CREATE INDEX idx_pending_items_status ON public.conversation_pending_items(status);
CREATE INDEX idx_pending_items_composite ON public.conversation_pending_items(user_phone, restaurant_id, status);