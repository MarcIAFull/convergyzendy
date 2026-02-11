-- Add ZSAPI credentials and api_type to restaurant_zonesoft_config
-- Per ZoneSoft support: ZSROI (ordering) and ZSAPI (sync) are separate integrations
ALTER TABLE public.restaurant_zonesoft_config 
ADD COLUMN IF NOT EXISTS zsapi_client_id text,
ADD COLUMN IF NOT EXISTS zsapi_app_key text,
ADD COLUMN IF NOT EXISTS zsapi_app_secret text,
ADD COLUMN IF NOT EXISTS api_type text DEFAULT 'zsroi';

COMMENT ON COLUMN public.restaurant_zonesoft_config.api_type IS 'Which ZoneSoft API to use: zsroi (ordering), zsapi (sync), or both';
COMMENT ON COLUMN public.restaurant_zonesoft_config.zsapi_client_id IS 'Client ID for ZSAPI integration (product sync, documents)';
COMMENT ON COLUMN public.restaurant_zonesoft_config.zsapi_app_key IS 'App Key for ZSAPI integration';
COMMENT ON COLUMN public.restaurant_zonesoft_config.zsapi_app_secret IS 'App Secret for ZSAPI integration';