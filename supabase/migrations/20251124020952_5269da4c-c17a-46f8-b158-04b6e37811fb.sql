
-- Insert WhatsApp instance for Convergy
INSERT INTO whatsapp_instances (
  instance_name,
  restaurant_id,
  status,
  last_checked_at,
  last_connected_at,
  phone_number
) VALUES (
  'convergy',
  'a7d3e7b5-57e1-43b9-8c70-7bd7bb7ec11e',
  'connected',
  NOW(),
  NOW(),
  '+5532840410072'
)
ON CONFLICT (restaurant_id) 
DO UPDATE SET
  instance_name = EXCLUDED.instance_name,
  status = EXCLUDED.status,
  last_checked_at = EXCLUDED.last_checked_at,
  last_connected_at = EXCLUDED.last_connected_at,
  phone_number = EXCLUDED.phone_number;
