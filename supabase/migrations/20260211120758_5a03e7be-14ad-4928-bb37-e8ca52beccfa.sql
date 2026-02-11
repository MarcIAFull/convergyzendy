
-- Function to cleanup expired carts (>24h)
CREATE OR REPLACE FUNCTION public.cleanup_expired_carts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expired_count INTEGER;
  v_pending_count INTEGER;
  v_state_count INTEGER;
BEGIN
  -- 1. Mark active carts older than 24h as expired
  UPDATE carts SET status = 'expired'
  WHERE status = 'active' 
    AND updated_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- 2. Clean up old pending items
  DELETE FROM conversation_pending_items
  WHERE status = 'pending' 
    AND created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_pending_count = ROW_COUNT;

  -- 3. Reset conversation state for recently expired carts
  UPDATE conversation_state 
  SET state = 'idle', metadata = '{}'::jsonb
  WHERE cart_id IN (
    SELECT id FROM carts 
    WHERE status = 'expired' 
      AND updated_at > NOW() - INTERVAL '25 hours'
  );
  GET DIAGNOSTICS v_state_count = ROW_COUNT;

  RAISE LOG 'cleanup_expired_carts: expired=% pending_deleted=% states_reset=%', 
    v_expired_count, v_pending_count, v_state_count;
END;
$$;
