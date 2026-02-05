-- Add ai_ordering_enabled field to restaurant_ai_settings
ALTER TABLE public.restaurant_ai_settings 
ADD COLUMN IF NOT EXISTS ai_ordering_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.restaurant_ai_settings.ai_ordering_enabled IS 
  'Se false, IA funciona apenas como recepção, enviando link do menu para pedidos';