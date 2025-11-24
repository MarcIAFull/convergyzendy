-- =====================================================
-- PHASE 4: REAL-TIME NOTIFICATIONS SETUP (Fixed)
-- =====================================================

-- Set replica identity to FULL for complete row data (orders table may already have this)
DO $$ 
BEGIN
  ALTER TABLE orders REPLICA IDENTITY FULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER TABLE messages REPLICA IDENTITY FULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Create notifications preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  sound_enabled BOOLEAN DEFAULT true,
  new_order_enabled BOOLEAN DEFAULT true,
  new_message_enabled BOOLEAN DEFAULT true,
  recovery_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.notification_preferences;

-- RLS policies for notification_preferences
CREATE POLICY "Users can view their own preferences"
  ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON public.notification_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON public.notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;

-- Add trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Drop index if exists
DROP INDEX IF EXISTS idx_notification_preferences_user_id;

-- Create index for performance
CREATE INDEX idx_notification_preferences_user_id ON public.notification_preferences(user_id);