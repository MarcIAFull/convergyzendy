-- PHASE 1: Drop and recreate RPC function with qualified references
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
  -- Check if the requesting user has access to this restaurant
  -- Either they are a member or they are an admin
  IF NOT EXISTS (
    SELECT 1 FROM restaurant_owners 
    WHERE restaurant_owners.restaurant_id = p_restaurant_id 
    AND restaurant_owners.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied to this restaurant';
  END IF;

  -- Return team members with their emails
  RETURN QUERY
  SELECT 
    ro.id,
    ro.restaurant_id,
    ro.user_id,
    ro.role,
    ro.permissions,
    ro.created_at,
    COALESCE(u.email, 'N/A') as user_email
  FROM restaurant_owners ro
  LEFT JOIN auth.users u ON u.id = ro.user_id
  WHERE ro.restaurant_id = p_restaurant_id
  ORDER BY ro.created_at DESC;
END;
$$;

-- PHASE 3: Add RLS policy for public invitation token access
CREATE POLICY "Anyone can view invitation by valid token"
ON team_invitations FOR SELECT
USING (
  status = 'pending' 
  AND expires_at > now()
);