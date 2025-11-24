
-- ================================================
-- FIX: RLS Policies for restaurant-assets bucket
-- ================================================

-- Policy: SELECT - Anyone can view public restaurant assets
DROP POLICY IF EXISTS "Public restaurant assets are viewable by everyone" ON storage.objects;
CREATE POLICY "Public restaurant assets are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-assets');

-- Policy: INSERT - Users can upload their restaurant assets
DROP POLICY IF EXISTS "Users can upload their restaurant assets" ON storage.objects;
CREATE POLICY "Users can upload their restaurant assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'restaurant-assets' 
  AND auth.uid() IN (
    SELECT user_id 
    FROM public.restaurants 
    WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Policy: UPDATE - Users can update their restaurant assets
DROP POLICY IF EXISTS "Users can update their restaurant assets" ON storage.objects;
CREATE POLICY "Users can update their restaurant assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'restaurant-assets'
  AND auth.uid() IN (
    SELECT user_id 
    FROM public.restaurants 
    WHERE id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'restaurant-assets'
  AND auth.uid() IN (
    SELECT user_id 
    FROM public.restaurants 
    WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Policy: DELETE - Users can delete their restaurant assets
DROP POLICY IF EXISTS "Users can delete their restaurant assets" ON storage.objects;
CREATE POLICY "Users can delete their restaurant assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'restaurant-assets'
  AND auth.uid() IN (
    SELECT user_id 
    FROM public.restaurants 
    WHERE id::text = (storage.foldername(name))[1]
  )
);
