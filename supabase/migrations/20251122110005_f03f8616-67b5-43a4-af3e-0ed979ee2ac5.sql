-- Add recovery_config to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS recovery_config JSONB DEFAULT '{
  "enabled": false,
  "types": {
    "cart_abandoned": {
      "enabled": true,
      "delay_minutes": 30,
      "max_attempts": 2,
      "message_template": "Olá {{customer_name}}! 👋 Notei que deixaste {{items_count}} item(ns) no carrinho. Ainda queres finalizar o pedido? Estou aqui para ajudar! 😊"
    },
    "conversation_paused": {
      "enabled": true,
      "delay_minutes": 15,
      "max_attempts": 1,
      "message_template": "Olá! 👋 Ficou alguma dúvida? Estou aqui para continuar o teu pedido! 😊"
    },
    "customer_inactive": {
      "enabled": false,
      "delay_days": 30,
      "max_attempts": 1,
      "message_template": "{{customer_name}}! 😊 Sentimos a tua falta! Que tal repetir aquele pedido? Temos novidades no cardápio! 🍕✨"
    }
  }
}'::jsonb;

-- Create conversation_recovery_attempts table
CREATE TABLE IF NOT EXISTS conversation_recovery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_phone TEXT NOT NULL,
  cart_id UUID REFERENCES carts(id) ON DELETE SET NULL,
  conversation_state_id UUID REFERENCES conversation_state(id) ON DELETE SET NULL,
  
  recovery_type TEXT NOT NULL,
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 2,
  
  cart_value NUMERIC,
  items_count INTEGER,
  last_state TEXT,
  customer_name TEXT,
  
  status TEXT DEFAULT 'pending',
  message_sent TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  recovered_at TIMESTAMP WITH TIME ZONE,
  
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_status ON conversation_recovery_attempts(status);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_scheduled ON conversation_recovery_attempts(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_phone_restaurant ON conversation_recovery_attempts(user_phone, restaurant_id);

-- Trigger for updated_at
CREATE TRIGGER update_conversation_recovery_attempts_updated_at
  BEFORE UPDATE ON conversation_recovery_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RPC: Detect abandoned carts
CREATE OR REPLACE FUNCTION detect_abandoned_carts(p_restaurant_id UUID, p_delay_minutes INTEGER DEFAULT 30)
RETURNS TABLE (
  cart_id UUID,
  user_phone TEXT,
  items_count BIGINT,
  cart_value NUMERIC,
  customer_name TEXT,
  minutes_since_activity NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as cart_id,
    c.user_phone,
    COUNT(ci.id) as items_count,
    SUM(p.price * ci.quantity) as cart_value,
    cu.name as customer_name,
    EXTRACT(EPOCH FROM (NOW() - c.updated_at))/60 as minutes_since_activity
  FROM carts c
  JOIN cart_items ci ON c.id = ci.cart_id
  JOIN products p ON ci.product_id = p.id
  LEFT JOIN customers cu ON c.user_phone = cu.phone
  WHERE c.restaurant_id = p_restaurant_id
    AND c.status = 'active'
    AND c.updated_at < NOW() - (p_delay_minutes || ' minutes')::INTERVAL
    AND c.updated_at > NOW() - INTERVAL '24 hours'
    AND c.id NOT IN (SELECT cart_id FROM orders WHERE cart_id IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM conversation_recovery_attempts cra
      WHERE cra.cart_id = c.id
        AND cra.recovery_type = 'cart_abandoned'
        AND cra.status IN ('pending', 'sent')
        AND cra.created_at > NOW() - INTERVAL '24 hours'
    )
  GROUP BY c.id, c.user_phone, cu.name, c.updated_at;
END;
$$ LANGUAGE plpgsql;

-- RPC: Detect paused conversations
CREATE OR REPLACE FUNCTION detect_paused_conversations(p_restaurant_id UUID, p_delay_minutes INTEGER DEFAULT 15)
RETURNS TABLE (
  conversation_state_id UUID,
  user_phone TEXT,
  last_state TEXT,
  minutes_since_activity NUMERIC,
  customer_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id as conversation_state_id,
    cs.user_phone,
    cs.state as last_state,
    EXTRACT(EPOCH FROM (NOW() - cs.updated_at))/60 as minutes_since_activity,
    cu.name as customer_name
  FROM conversation_state cs
  LEFT JOIN customers cu ON cs.user_phone = cu.phone
  WHERE cs.restaurant_id = p_restaurant_id
    AND cs.state != 'idle'
    AND cs.updated_at < NOW() - (p_delay_minutes || ' minutes')::INTERVAL
    AND cs.updated_at > NOW() - INTERVAL '2 hours'
    AND NOT EXISTS (
      SELECT 1 FROM conversation_recovery_attempts cra
      WHERE cra.user_phone = cs.user_phone
        AND cra.recovery_type = 'conversation_paused'
        AND cra.status IN ('pending', 'sent')
        AND cra.created_at > NOW() - INTERVAL '2 hours'
    );
END;
$$ LANGUAGE plpgsql;

-- RPC: Detect inactive customers
CREATE OR REPLACE FUNCTION detect_inactive_customers(p_restaurant_id UUID, p_delay_days INTEGER DEFAULT 30)
RETURNS TABLE (
  user_phone TEXT,
  customer_name TEXT,
  order_count INTEGER,
  days_since_last_order NUMERIC,
  preferred_items JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cin.phone as user_phone,
    cu.name as customer_name,
    COALESCE(cin.order_count, 0)::INTEGER as order_count,
    EXTRACT(EPOCH FROM (NOW() - cin.last_interaction_at))/(60*60*24) as days_since_last_order,
    cin.preferred_items
  FROM customer_insights cin
  LEFT JOIN customers cu ON cin.phone = cu.phone
  WHERE cin.order_count > 0
    AND cin.last_interaction_at < NOW() - (p_delay_days || ' days')::INTERVAL
    AND NOT EXISTS (
      SELECT 1 FROM conversation_recovery_attempts cra
      WHERE cra.user_phone = cin.phone
        AND cra.restaurant_id = p_restaurant_id
        AND cra.recovery_type = 'customer_inactive'
        AND cra.status IN ('pending', 'sent')
        AND cra.created_at > NOW() - INTERVAL '60 days'
    );
END;
$$ LANGUAGE plpgsql;