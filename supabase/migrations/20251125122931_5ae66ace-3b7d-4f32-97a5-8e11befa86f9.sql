-- Drop the insecure view
DROP VIEW IF EXISTS team_members_with_email;

-- Create a secure function to get team members with emails
-- Only returns members if the requesting user has access to the restaurant
CREATE OR REPLACE FUNCTION get_team_members_with_email(p_restaurant_id UUID)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  user_id UUID,
  role TEXT,
  permissions JSONB,
  created_at TIMESTAMPTZ,
  user_email TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the requesting user has access to this restaurant
  -- Either they are a member or they are an admin
  IF NOT EXISTS (
    SELECT 1 FROM restaurant_owners 
    WHERE restaurant_id = p_restaurant_id 
    AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
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