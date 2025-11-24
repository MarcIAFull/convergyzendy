-- Função para criar restaurante com verificação de autenticação
-- Esta função contorna problemas de RLS ao executar com privilégios elevados
CREATE OR REPLACE FUNCTION public.create_restaurant_with_owner(
  p_name text,
  p_phone text,
  p_address text,
  p_delivery_fee numeric,
  p_opening_hours jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_restaurant_id uuid;
  v_result json;
BEGIN
  -- Verificar autenticação
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Inserir restaurante
  INSERT INTO public.restaurants (
    name,
    phone,
    address,
    delivery_fee,
    opening_hours,
    is_open,
    user_id
  ) VALUES (
    p_name,
    p_phone,
    p_address,
    p_delivery_fee,
    COALESCE(p_opening_hours, '{"monday": {"open": "09:00", "close": "22:00"}, "tuesday": {"open": "09:00", "close": "22:00"}, "wednesday": {"open": "09:00", "close": "22:00"}, "thursday": {"open": "09:00", "close": "22:00"}, "friday": {"open": "09:00", "close": "22:00"}, "saturday": {"open": "09:00", "close": "22:00"}, "sunday": {"open": "09:00", "close": "22:00"}}'::jsonb),
    true,
    v_user_id
  )
  RETURNING id INTO v_restaurant_id;

  -- Criar associação de ownership
  INSERT INTO public.restaurant_owners (
    user_id,
    restaurant_id,
    role
  ) VALUES (
    v_user_id,
    v_restaurant_id,
    'owner'
  );

  -- Retornar resultado
  SELECT json_build_object(
    'id', v_restaurant_id,
    'user_id', v_user_id,
    'name', p_name,
    'success', true
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Garantir que usuários autenticados podem chamar a função
GRANT EXECUTE ON FUNCTION public.create_restaurant_with_owner TO authenticated;

COMMENT ON FUNCTION public.create_restaurant_with_owner IS 'Cria um restaurante e associa o usuário atual como owner. Executa com SECURITY DEFINER para contornar problemas de RLS.';