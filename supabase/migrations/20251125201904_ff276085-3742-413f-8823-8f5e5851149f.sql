
-- Adicionar role de admin para o usuário pedromagnago0@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'pedromagnago0@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
