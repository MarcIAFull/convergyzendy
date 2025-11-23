-- Corrigir política RLS para criação de restaurantes

-- 1. Remover a política atual de INSERT
DROP POLICY IF EXISTS "Users can create their own restaurants" ON public.restaurants;

-- 2. Criar uma nova política mais robusta
CREATE POLICY "Authenticated users can create restaurants with their user_id"
ON public.restaurants
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- 3. Adicionar uma função helper para verificar o contexto de autenticação (para debug)
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.uid();
$$;