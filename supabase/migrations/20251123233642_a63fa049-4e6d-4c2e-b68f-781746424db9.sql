-- Fix restaurants.user_id and RLS policies for proper authentication

-- 1. Update existing restaurants without user_id (assign to first owner)
UPDATE public.restaurants r
SET user_id = (
  SELECT ro.user_id 
  FROM public.restaurant_owners ro 
  WHERE ro.restaurant_id = r.id 
  LIMIT 1
)
WHERE user_id IS NULL;

-- 2. Make user_id NOT NULL since it's required for RLS
ALTER TABLE public.restaurants 
  ALTER COLUMN user_id SET NOT NULL;

-- 3. Drop old RLS policy
DROP POLICY IF EXISTS "Authenticated users can create restaurants" ON public.restaurants;

-- 4. Create correct RLS policy that validates user_id matches auth.uid()
CREATE POLICY "Users can create their own restaurants"
  ON public.restaurants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);