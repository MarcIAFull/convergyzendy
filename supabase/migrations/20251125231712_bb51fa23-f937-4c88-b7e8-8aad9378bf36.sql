-- Add unique constraint for debounce queue to prevent race conditions
-- This ensures only ONE pending entry per restaurant+customer combination

-- First, clean up any existing duplicates by keeping the oldest pending entry
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY restaurant_id, customer_phone, status 
      ORDER BY created_at ASC
    ) as rn
  FROM message_debounce_queue
  WHERE status = 'pending'
)
UPDATE message_debounce_queue
SET status = 'duplicate_removed'
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Create unique partial index (only for pending entries)
CREATE UNIQUE INDEX IF NOT EXISTS idx_debounce_queue_unique_pending
ON message_debounce_queue (restaurant_id, customer_phone)
WHERE status = 'pending';

-- Add comment explaining the constraint
COMMENT ON INDEX idx_debounce_queue_unique_pending IS 
'Ensures only one pending debounce entry per restaurant+customer to prevent race conditions when multiple messages arrive simultaneously';