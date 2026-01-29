-- Adicionar coluna max_addons à tabela products
-- NULL significa sem limite (comportamento anterior)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS max_addons INTEGER DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.products.max_addons IS 'Limite máximo de adicionais que o cliente pode selecionar. NULL = sem limite.';