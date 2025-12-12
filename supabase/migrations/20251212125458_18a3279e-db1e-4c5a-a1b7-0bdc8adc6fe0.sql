-- Add search optimization columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_keywords TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients TEXT[] DEFAULT '{}';

-- Create product_synonyms table for restaurant-specific term mappings
CREATE TABLE IF NOT EXISTS product_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  original_term TEXT NOT NULL,
  synonym TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(restaurant_id, original_term, synonym)
);

-- Create index for fast synonym lookups
CREATE INDEX IF NOT EXISTS idx_product_synonyms_restaurant ON product_synonyms(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_product_synonyms_term ON product_synonyms(original_term);

-- Enable RLS
ALTER TABLE product_synonyms ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_synonyms
CREATE POLICY "Users can view their restaurant synonyms"
ON product_synonyms FOR SELECT
USING (user_has_restaurant_access(restaurant_id));

CREATE POLICY "Users can manage their restaurant synonyms"
ON product_synonyms FOR ALL
USING (user_has_restaurant_access(restaurant_id));

-- Create GIN indexes for array searches
CREATE INDEX IF NOT EXISTS idx_products_search_keywords ON products USING GIN(search_keywords);
CREATE INDEX IF NOT EXISTS idx_products_ingredients ON products USING GIN(ingredients);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE product_synonyms;