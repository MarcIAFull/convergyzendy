-- Fix customers table RLS: Remove public access

-- Drop the overly permissive policy that allows public access
DROP POLICY IF EXISTS "Service role can manage all customers" ON public.customers;

-- Create a policy that blocks authenticated users from deleting (only service role can)
CREATE POLICY "Only backend can delete customers"
ON public.customers
FOR DELETE
TO authenticated
USING (false);

-- The existing policies are correct:
-- "Users can view their restaurant customers" (SELECT with user_has_restaurant_access)
-- "Users can update their restaurant customers" (UPDATE with user_has_restaurant_access)
-- "Users can insert customers for their restaurant" (INSERT with user_has_restaurant_access)