-- Adicionar configurações de mesa ao restaurant_settings
ALTER TABLE public.restaurant_settings 
ADD COLUMN IF NOT EXISTS dine_in_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS dine_in_require_table_number BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS dine_in_table_prefix TEXT DEFAULT 'Mesa',
ADD COLUMN IF NOT EXISTS takeaway_enabled BOOLEAN DEFAULT false;

-- Adicionar campos de tipo de pedido às web_orders
ALTER TABLE public.web_orders 
ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'delivery',
ADD COLUMN IF NOT EXISTS table_number TEXT;

-- Adicionar constraint de validação para order_type
ALTER TABLE public.web_orders 
ADD CONSTRAINT web_orders_order_type_check 
CHECK (order_type IN ('delivery', 'dine_in', 'takeaway'));

-- Comentários de documentação
COMMENT ON COLUMN public.restaurant_settings.dine_in_enabled IS 'Habilita opção de pedido em mesa no checkout';
COMMENT ON COLUMN public.restaurant_settings.dine_in_require_table_number IS 'Se true, número da mesa é obrigatório para dine_in';
COMMENT ON COLUMN public.restaurant_settings.dine_in_table_prefix IS 'Prefixo para exibição da mesa (ex: Mesa, Table)';
COMMENT ON COLUMN public.restaurant_settings.takeaway_enabled IS 'Habilita opção Take and Go no checkout';
COMMENT ON COLUMN public.web_orders.order_type IS 'Tipo de pedido: delivery, dine_in (mesa), takeaway (Take and Go)';
COMMENT ON COLUMN public.web_orders.table_number IS 'Número da mesa para pedidos dine_in';