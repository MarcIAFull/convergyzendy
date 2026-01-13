-- Add payment methods configuration to restaurant_settings
ALTER TABLE public.restaurant_settings 
ADD COLUMN IF NOT EXISTS accepted_payment_methods jsonb DEFAULT '{"cash": true, "card": true, "mbway": false}'::jsonb;

-- Add MBWay code for receiving payments
ALTER TABLE public.restaurant_settings 
ADD COLUMN IF NOT EXISTS mbway_phone_number text;

-- Add comment for documentation
COMMENT ON COLUMN public.restaurant_settings.accepted_payment_methods IS 'JSON object with enabled payment methods: cash, card, mbway';
COMMENT ON COLUMN public.restaurant_settings.mbway_phone_number IS 'Phone number for receiving MBWay payments';