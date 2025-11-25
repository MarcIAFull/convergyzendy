-- Create AI interaction logs table for debugging
CREATE TABLE public.ai_interaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Identifiers
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  conversation_id UUID,
  
  -- User message
  user_message TEXT NOT NULL,
  
  -- Conversation state
  state_before TEXT,
  state_after TEXT,
  
  -- Orchestrator classification
  orchestrator_intent TEXT,
  orchestrator_confidence NUMERIC,
  orchestrator_target_state TEXT,
  orchestrator_reasoning TEXT,
  
  -- Loaded context (JSONB for flexibility)
  context_loaded JSONB DEFAULT '{}'::jsonb,
  
  -- Prompt sent to OpenAI
  system_prompt TEXT,
  prompt_length INTEGER,
  
  -- OpenAI request
  ai_request JSONB DEFAULT '{}'::jsonb,
  
  -- OpenAI response
  ai_response_raw JSONB DEFAULT '{}'::jsonb,
  ai_response_text TEXT,
  
  -- Tool calls
  tool_calls_requested JSONB DEFAULT '[]'::jsonb,
  tool_calls_validated JSONB DEFAULT '[]'::jsonb,
  tool_execution_results JSONB DEFAULT '[]'::jsonb,
  
  -- Final response
  final_response TEXT,
  
  -- Metrics
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  
  -- Errors
  errors JSONB DEFAULT '[]'::jsonb,
  has_errors BOOLEAN DEFAULT false,
  
  -- Log level
  log_level TEXT DEFAULT 'info' CHECK (log_level IN ('info', 'warning', 'error'))
);

-- Indexes for performance
CREATE INDEX idx_ai_logs_restaurant ON public.ai_interaction_logs(restaurant_id);
CREATE INDEX idx_ai_logs_created ON public.ai_interaction_logs(created_at DESC);
CREATE INDEX idx_ai_logs_phone ON public.ai_interaction_logs(customer_phone);
CREATE INDEX idx_ai_logs_intent ON public.ai_interaction_logs(orchestrator_intent);
CREATE INDEX idx_ai_logs_errors ON public.ai_interaction_logs(has_errors) WHERE has_errors = true;
CREATE INDEX idx_ai_logs_log_level ON public.ai_interaction_logs(log_level);

-- RLS policies
ALTER TABLE public.ai_interaction_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their restaurants
CREATE POLICY "Users can view their restaurant AI logs"
  ON public.ai_interaction_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = ai_interaction_logs.restaurant_id
      AND public.user_has_restaurant_access(restaurants.id)
    )
  );

-- Admins can view all logs
CREATE POLICY "Admins can view all AI logs"
  ON public.ai_interaction_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Service role can manage all logs
CREATE POLICY "Service role can manage AI logs"
  ON public.ai_interaction_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.ai_interaction_logs IS 'Comprehensive logs of AI interactions for debugging and monitoring';