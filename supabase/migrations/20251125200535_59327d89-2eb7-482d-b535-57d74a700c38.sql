-- Drop and recreate the function with explicit casts
DROP FUNCTION IF EXISTS get_team_members_with_email(uuid);

CREATE OR REPLACE FUNCTION public.get_team_members_with_email(p_restaurant_id uuid)
RETURNS TABLE(
  id uuid,
  restaurant_id uuid,
  user_id uuid,
  role text,
  permissions jsonb,
  created_at timestamp with time zone,
  user_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário tem acesso (é owner do restaurante ou admin global)
  IF NOT EXISTS (
    SELECT 1 FROM restaurant_owners 
    WHERE restaurant_owners.restaurant_id = p_restaurant_id 
    AND restaurant_owners.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  ) THEN
    RAISE EXCEPTION 'Access denied to this restaurant';
  END IF;

  -- Retornar membros com email (cast explícito de varchar para text)
  RETURN QUERY
  SELECT 
    ro.id,
    ro.restaurant_id,
    ro.user_id,
    ro.role,
    ro.permissions,
    ro.created_at,
    COALESCE(u.email::text, 'N/A')::text as user_email
  FROM restaurant_owners ro
  LEFT JOIN auth.users u ON u.id = ro.user_id
  WHERE ro.restaurant_id = p_restaurant_id
  ORDER BY ro.created_at DESC;
END;
$$;