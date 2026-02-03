-- Fase 1: Adicionar campo free_addons_count para definir quantos addons são gratuitos
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS free_addons_count INTEGER DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.products.free_addons_count IS 'Número de addons gratuitos inclusos no produto. NULL = nenhum grátis, 0 = nenhum grátis, N = primeiros N addons são grátis';