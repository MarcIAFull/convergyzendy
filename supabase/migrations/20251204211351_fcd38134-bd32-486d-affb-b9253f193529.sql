-- Fix customer_insights RLS: Remove public access

-- Drop the overly permissive policy that allows public access
DROP POLICY IF EXISTS "Webhooks can manage customer insights" ON public.customer_insights;

-- Create a policy that blocks authenticated users from inserting (only service role can)
CREATE POLICY "Only backend can insert customer insights"
ON public.customer_insights
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Create a policy that blocks authenticated users from updating (only service role can)
CREATE POLICY "Only backend can update customer insights"
ON public.customer_insights
FOR UPDATE
TO authenticated
USING (false);

-- Create a policy that blocks authenticated users from deleting (only service role can)
CREATE POLICY "Only backend can delete customer insights"
ON public.customer_insights
FOR DELETE
TO authenticated
USING (false);

-- The existing SELECT policy is correct:
-- "Users can view customer insights for their restaurant" - uses user_has_restaurant_access() via orders table