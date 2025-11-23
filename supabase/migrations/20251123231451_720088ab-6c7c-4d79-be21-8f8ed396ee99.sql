-- ============================================================
-- PART 3: PER-RESTAURANT AI SETTINGS
-- ============================================================
-- This migration adds per-restaurant AI configuration while
-- keeping agents global. Settings are used as parameters to
-- tweak behavior, not as free-form instructions.

-- Table: restaurant_ai_settings
-- Stores AI behavior configuration per restaurant
CREATE TABLE public.restaurant_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  
  -- Tone and style
  tone TEXT NOT NULL DEFAULT 'friendly',
  greeting_message TEXT,
  closing_message TEXT,
  
  -- Behavior settings
  upsell_aggressiveness TEXT NOT NULL DEFAULT 'medium' CHECK (upsell_aggressiveness IN ('low', 'medium', 'high')),
  max_additional_questions_before_checkout INTEGER NOT NULL DEFAULT 2,
  
  -- Localization
  language TEXT NOT NULL DEFAULT 'pt-BR',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Only one settings row per restaurant
  UNIQUE(restaurant_id)
);

-- RLS for restaurant_ai_settings
ALTER TABLE public.restaurant_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their restaurant AI settings"
  ON public.restaurant_ai_settings
  FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can insert their restaurant AI settings"
  ON public.restaurant_ai_settings
  FOR INSERT
  WITH CHECK (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can update their restaurant AI settings"
  ON public.restaurant_ai_settings
  FOR UPDATE
  USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can delete their restaurant AI settings"
  ON public.restaurant_ai_settings
  FOR DELETE
  USING (user_has_restaurant_access(restaurant_id));

-- Service role can manage all settings (for edge functions)
CREATE POLICY "Service role can manage all AI settings"
  ON public.restaurant_ai_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Table: restaurant_prompt_overrides
-- Allows restaurants to override specific sections of global prompts
CREATE TABLE public.restaurant_prompt_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  
  -- Which part of the prompt is being overridden
  block_key TEXT NOT NULL,
  
  -- Override content
  content TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Only one override per block per restaurant
  UNIQUE(restaurant_id, block_key)
);

-- RLS for restaurant_prompt_overrides
ALTER TABLE public.restaurant_prompt_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their restaurant prompt overrides"
  ON public.restaurant_prompt_overrides
  FOR SELECT
  USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can manage their restaurant prompt overrides"
  ON public.restaurant_prompt_overrides
  FOR ALL
  USING (user_has_restaurant_access(restaurant_id));

-- Service role can manage all overrides (for edge functions)
CREATE POLICY "Service role can manage all prompt overrides"
  ON public.restaurant_prompt_overrides
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger for restaurant_ai_settings
CREATE TRIGGER update_restaurant_ai_settings_updated_at
  BEFORE UPDATE ON public.restaurant_ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for restaurant_prompt_overrides
CREATE TRIGGER update_restaurant_prompt_overrides_updated_at
  BEFORE UPDATE ON public.restaurant_prompt_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default AI settings for existing restaurants
INSERT INTO public.restaurant_ai_settings (restaurant_id, tone, upsell_aggressiveness, max_additional_questions_before_checkout, language)
SELECT 
  id,
  'friendly',
  'medium',
  2,
  'pt-BR'
FROM public.restaurants
ON CONFLICT (restaurant_id) DO NOTHING;