
-- Correção 1: Atualizar cleanup_expired_carts para 12 horas
CREATE OR REPLACE FUNCTION public.cleanup_expired_carts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Expirar carrinhos ativos com mais de 12 horas
  UPDATE carts 
  SET status = 'expired', updated_at = now()
  WHERE status = 'active' 
  AND updated_at < NOW() - INTERVAL '12 hours';

  -- 2. Limpar pending items com mais de 12 horas
  DELETE FROM conversation_pending_items 
  WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '12 hours';

  -- 3. Resetar conversation_state para idle quando carrinho associado expirou
  UPDATE conversation_state 
  SET state = 'idle', metadata = '{}', cart_id = NULL, updated_at = now()
  WHERE cart_id IN (
    SELECT id FROM carts 
    WHERE status = 'expired' 
    AND updated_at > NOW() - INTERVAL '13 hours'
  );

  RAISE LOG 'cleanup_expired_carts: completed successfully';
END;
$$;
