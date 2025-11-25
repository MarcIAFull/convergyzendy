-- Adicionar políticas RLS para admins visualizarem e gerenciarem todos os restaurantes

-- Admins podem ver TODOS os restaurantes
CREATE POLICY "Admins can view all restaurants"
ON public.restaurants
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins podem atualizar TODOS os restaurantes
CREATE POLICY "Admins can update all restaurants"
ON public.restaurants
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins podem deletar TODOS os restaurantes
CREATE POLICY "Admins can delete all restaurants"
ON public.restaurants
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));