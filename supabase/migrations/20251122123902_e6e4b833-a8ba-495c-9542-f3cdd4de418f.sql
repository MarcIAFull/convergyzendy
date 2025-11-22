
-- Associar o restaurante existente ao usuário atual
INSERT INTO public.restaurant_owners (user_id, restaurant_id, role)
VALUES (
  '304fcbae-4012-4851-880c-0338532fed9e'::uuid, -- pedromagnago0@gmail.com
  'a7d3e7b5-57e1-43b9-8c70-7bd7bb7ec11e'::uuid, -- Convergy - Doces
  'owner'
)
ON CONFLICT (user_id, restaurant_id) DO NOTHING;
