-- Fix existing restaurant_owners with null user_id
-- This updates any restaurant_owners entry where user_id is null
-- to use the user_id from the associated restaurant (if it has one)
UPDATE restaurant_owners ro
SET user_id = r.user_id
FROM restaurants r
WHERE ro.restaurant_id = r.id 
  AND ro.user_id IS NULL 
  AND r.user_id IS NOT NULL;

-- For restaurants where both are null, we need to handle this manually
-- by looking at auth.users and finding the appropriate user
-- Since we only have one user in the system, we can assign it to them
UPDATE restaurant_owners ro
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE ro.user_id IS NULL 
  AND NOT EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = ro.restaurant_id 
    AND r.user_id IS NOT NULL
  );