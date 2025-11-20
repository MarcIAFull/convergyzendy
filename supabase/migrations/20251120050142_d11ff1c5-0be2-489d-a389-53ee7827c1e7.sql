-- Add metadata column to conversation_state table
-- This column stores session-specific data like pending_product, delivery_address, payment_method
ALTER TABLE conversation_state 
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Add GIN index for efficient JSONB querying
CREATE INDEX idx_conversation_state_metadata ON conversation_state USING gin(metadata);

-- Add column comment
COMMENT ON COLUMN conversation_state.metadata IS 'Stores session data: pending_product, last_shown_product, delivery_address, payment_method';