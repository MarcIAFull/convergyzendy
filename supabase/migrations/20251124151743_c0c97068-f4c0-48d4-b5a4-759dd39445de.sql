-- Políticas de Storage para bucket restaurant-assets

-- Política INSERT: Usuários autenticados podem fazer upload para pasta do seu restaurante
CREATE POLICY "Authenticated users can upload to their restaurant folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'restaurant-assets'
  AND public.user_has_restaurant_access((storage.foldername(name))[1]::uuid)
);

-- Política UPDATE: Usuários autenticados podem atualizar arquivos do seu restaurante
CREATE POLICY "Authenticated users can update their restaurant files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'restaurant-assets'
  AND public.user_has_restaurant_access((storage.foldername(name))[1]::uuid)
);

-- Política DELETE: Usuários autenticados podem deletar arquivos do seu restaurante
CREATE POLICY "Authenticated users can delete their restaurant files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'restaurant-assets'
  AND public.user_has_restaurant_access((storage.foldername(name))[1]::uuid)
);