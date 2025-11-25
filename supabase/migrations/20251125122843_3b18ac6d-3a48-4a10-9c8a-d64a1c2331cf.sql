-- Create a view to easily get team members with their emails
-- This avoids the need to use admin API in the frontend
CREATE OR REPLACE VIEW team_members_with_email AS
SELECT 
  ro.id,
  ro.restaurant_id,
  ro.user_id,
  ro.role,
  ro.permissions,
  ro.created_at,
  u.email as user_email
FROM restaurant_owners ro
LEFT JOIN auth.users u ON u.id = ro.user_id;

-- Grant access to authenticated users
GRANT SELECT ON team_members_with_email TO authenticated;

-- Add RLS policy so users can only see members of their restaurants
ALTER VIEW team_members_with_email SET (security_invoker = true);