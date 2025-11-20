-- Create conversation_state table to persist the order flow state machine
CREATE TABLE IF NOT EXISTS public.conversation_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_phone TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'idle',
  cart_id UUID REFERENCES public.carts(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT conversation_state_unique_user UNIQUE (restaurant_id, user_phone)
);

-- Enable RLS
ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (same as other tables in this system)
CREATE POLICY "Public can view conversation state" 
  ON public.conversation_state 
  FOR SELECT 
  USING (true);

CREATE POLICY "Public can insert conversation state" 
  ON public.conversation_state 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Public can update conversation state" 
  ON public.conversation_state 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Public can delete conversation state" 
  ON public.conversation_state 
  FOR DELETE 
  USING (true);

-- Create index for fast lookups
CREATE INDEX idx_conversation_state_lookup 
  ON public.conversation_state(restaurant_id, user_phone);

-- Create trigger for updated_at
CREATE TRIGGER update_conversation_state_updated_at
  BEFORE UPDATE ON public.conversation_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.conversation_state IS 'Stores the current state of each customer conversation in the ordering flow state machine';