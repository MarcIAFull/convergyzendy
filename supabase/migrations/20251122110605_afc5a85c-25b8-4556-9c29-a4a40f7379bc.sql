-- Add next_attempt_at column if not exists
ALTER TABLE conversation_recovery_attempts 
ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP WITH TIME ZONE;

-- Add index for next_attempt_at
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_next_attempt 
ON conversation_recovery_attempts(next_attempt_at) 
WHERE status = 'sent' AND attempt_number < max_attempts;