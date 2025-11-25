-- Add new personalization fields to restaurant_ai_settings
ALTER TABLE restaurant_ai_settings 
ADD COLUMN IF NOT EXISTS custom_instructions text,
ADD COLUMN IF NOT EXISTS business_rules text,
ADD COLUMN IF NOT EXISTS faq_responses text,
ADD COLUMN IF NOT EXISTS unavailable_items_handling text,
ADD COLUMN IF NOT EXISTS special_offers_info text;

COMMENT ON COLUMN restaurant_ai_settings.custom_instructions IS 'Instruções personalizadas sobre comportamento do agente';
COMMENT ON COLUMN restaurant_ai_settings.business_rules IS 'Regras de negócio específicas do restaurante';
COMMENT ON COLUMN restaurant_ai_settings.faq_responses IS 'Respostas para perguntas frequentes';
COMMENT ON COLUMN restaurant_ai_settings.unavailable_items_handling IS 'Como lidar com itens indisponíveis';
COMMENT ON COLUMN restaurant_ai_settings.special_offers_info IS 'Informações sobre promoções ativas';