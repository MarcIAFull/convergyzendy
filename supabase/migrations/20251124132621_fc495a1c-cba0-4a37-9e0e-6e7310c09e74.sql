-- Criar tabela conversation_mode para gerenciar modo de atendimento (IA/Manual)
CREATE TABLE IF NOT EXISTS public.conversation_mode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  user_phone TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ai', 'manual')),
  taken_over_by UUID,
  taken_over_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(restaurant_id, user_phone)
);

-- Enable RLS
ALTER TABLE public.conversation_mode ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their restaurant conversation modes"
ON public.conversation_mode FOR SELECT
USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can insert their restaurant conversation modes"
ON public.conversation_mode FOR INSERT
WITH CHECK (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can update their restaurant conversation modes"
ON public.conversation_mode FOR UPDATE
USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can delete their restaurant conversation modes"
ON public.conversation_mode FOR DELETE
USING (user_has_restaurant_access(restaurant_id));

-- Service role full access
CREATE POLICY "Service role can manage conversation modes"
ON public.conversation_mode FOR ALL
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_conversation_mode_updated_at
BEFORE UPDATE ON public.conversation_mode
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index para melhor performance
CREATE INDEX idx_conversation_mode_restaurant_phone ON public.conversation_mode(restaurant_id, user_phone);
CREATE INDEX idx_conversation_mode_mode ON public.conversation_mode(mode);