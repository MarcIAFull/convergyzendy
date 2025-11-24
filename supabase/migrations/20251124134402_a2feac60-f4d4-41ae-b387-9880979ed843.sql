-- Add sent_by column to track message origin
ALTER TABLE messages 
ADD COLUMN sent_by TEXT CHECK (sent_by IN ('ai', 'human', 'system'));

-- Create index for better query performance
CREATE INDEX idx_messages_sent_by ON messages(sent_by);

-- Update existing outbound messages to 'ai' (default assumption)
UPDATE messages 
SET sent_by = 'ai' 
WHERE direction = 'outbound' AND sent_by IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN messages.sent_by IS 'Origin of outbound messages: ai (sent by AI), human (sent manually), system (automated)';