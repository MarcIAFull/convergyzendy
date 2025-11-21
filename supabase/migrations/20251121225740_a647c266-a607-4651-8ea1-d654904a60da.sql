-- Add last_shown_products to conversation_state for tracking menu search results
ALTER TABLE conversation_state 
ADD COLUMN last_shown_products JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN conversation_state.last_shown_products IS 'Stores products shown via search_menu for positional selection (e.g., "a segunda", "número 3")';