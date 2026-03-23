-- Update Graça (store 1) with new ZSROI credentials
UPDATE restaurant_zonesoft_config
SET 
  client_id = '13E555D79C3EF5F6AD87893A70A57571',
  app_key = 'EC23302FEC23302FF9F93FF93F9F9F559F5500E0D470E71D2E14D470E71D2E14',
  app_secret = '1E45691D1224E7F7B0501D8FF91AE5F4',
  api_type = 'zsroi',
  updated_at = now()
WHERE restaurant_id = 'e6daadcd-3546-4c27-8e1c-1ec5cf80e7ad';

-- Update Barreiro (store 2) with new ZSROI credentials
-- Move zsapi_* values to primary fields (they are ZSROI creds, not ZSAPI)
-- Clear zsapi_* fields (no ZSAPI integration exists yet)
UPDATE restaurant_zonesoft_config
SET 
  client_id = '768D04DD60CB7BACF7232E58D30C8D54',
  app_key = 'EC23302FEC23302FF9F93FF93F9F9F559F5500E0D470E71D2E14D470E71D2E14',
  app_secret = '1E45691D1224E7F7B0501D8FF91AE5F4',
  zsapi_client_id = NULL,
  zsapi_app_key = NULL,
  zsapi_app_secret = NULL,
  api_type = 'zsroi',
  enabled = true,
  updated_at = now()
WHERE restaurant_id = 'ac4ed81b-0b2c-4c21-a6a5-f8fb28cfffef';