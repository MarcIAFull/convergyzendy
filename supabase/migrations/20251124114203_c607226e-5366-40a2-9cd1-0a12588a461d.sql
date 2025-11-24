-- Migrar instância antiga "convergy" para o padrão multi-tenant
-- Atualiza o nome da instância para o formato restaurant_{id}

UPDATE whatsapp_instances
SET 
  instance_name = 'restaurant_' || substring(restaurant_id::text, 1, 8),
  updated_at = now()
WHERE instance_name = 'convergy';

-- Adicionar constraint de unicidade para garantir 1 instância por restaurante
ALTER TABLE whatsapp_instances
DROP CONSTRAINT IF EXISTS unique_restaurant_instance;

ALTER TABLE whatsapp_instances
ADD CONSTRAINT unique_restaurant_instance 
UNIQUE (restaurant_id);