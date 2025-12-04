-- Fix ai_interaction_logs RLS: Remove public access, allow only authenticated restaurant owners to view their logs

-- Drop the overly permissive policy that allows public access
DROP POLICY IF EXISTS "Service role can manage AI logs" ON public.ai_interaction_logs;

-- Create a new policy that only allows INSERT from service role (edge functions)
-- Note: Service role bypasses RLS automatically, so we just need to ensure 
-- regular users cannot insert - only backend can create logs
CREATE POLICY "Only backend can insert AI logs"
ON public.ai_interaction_logs
FOR INSERT
TO authenticated
WITH CHECK (false);

-- The existing policies are correct:
-- "Users can view their restaurant AI logs" - uses user_has_restaurant_access()
-- "Admins can view all AI logs" - uses has_role()

-- Verify by checking remaining policies should be:
-- 1. Users can view their restaurant AI logs (SELECT with user_has_restaurant_access)
-- 2. Admins can view all AI logs (SELECT with has_role)
-- 3. Only backend can insert AI logs (INSERT blocked for authenticated users, service role bypasses)