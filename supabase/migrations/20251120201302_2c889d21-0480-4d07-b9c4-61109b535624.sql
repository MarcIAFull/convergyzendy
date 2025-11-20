-- AI Configuration Module: Tables for managing AI agents, tools, and prompts

-- agents table: Core configuration for each AI agent
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('orchestrator', 'assistant')),
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  temperature FLOAT NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INTEGER NOT NULL DEFAULT 1000 CHECK (max_tokens > 0),
  top_p FLOAT DEFAULT 1.0 CHECK (top_p >= 0 AND top_p <= 1),
  frequency_penalty FLOAT DEFAULT 0.0 CHECK (frequency_penalty >= -2 AND frequency_penalty <= 2),
  presence_penalty FLOAT DEFAULT 0.0 CHECK (presence_penalty >= -2 AND presence_penalty <= 2),
  base_system_prompt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  behavior_config JSONB DEFAULT '{}'::jsonb,
  orchestration_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- agent_tools table: Tools enabled for each agent
CREATE TABLE IF NOT EXISTS public.agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  ordering INTEGER NOT NULL DEFAULT 0,
  description_override TEXT,
  usage_rules TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id, tool_name)
);

-- agent_prompt_blocks table: Modular prompt blocks for building system prompts
CREATE TABLE IF NOT EXISTS public.agent_prompt_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  ordering INTEGER NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_tools_agent_id ON public.agent_tools(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_prompt_blocks_agent_id ON public.agent_prompt_blocks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON public.agents(is_active);

-- Trigger for updating updated_at on agents
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updating updated_at on agent_tools
CREATE TRIGGER update_agent_tools_updated_at
  BEFORE UPDATE ON public.agent_tools
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updating updated_at on agent_prompt_blocks
CREATE TRIGGER update_agent_prompt_blocks_updated_at
  BEFORE UPDATE ON public.agent_prompt_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_prompt_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow public access for now (since all other tables are public)
CREATE POLICY "Public can view agents" ON public.agents FOR SELECT USING (true);
CREATE POLICY "Public can insert agents" ON public.agents FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update agents" ON public.agents FOR UPDATE USING (true);
CREATE POLICY "Public can delete agents" ON public.agents FOR DELETE USING (true);

CREATE POLICY "Public can view agent_tools" ON public.agent_tools FOR SELECT USING (true);
CREATE POLICY "Public can insert agent_tools" ON public.agent_tools FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update agent_tools" ON public.agent_tools FOR UPDATE USING (true);
CREATE POLICY "Public can delete agent_tools" ON public.agent_tools FOR DELETE USING (true);

CREATE POLICY "Public can view agent_prompt_blocks" ON public.agent_prompt_blocks FOR SELECT USING (true);
CREATE POLICY "Public can insert agent_prompt_blocks" ON public.agent_prompt_blocks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update agent_prompt_blocks" ON public.agent_prompt_blocks FOR UPDATE USING (true);
CREATE POLICY "Public can delete agent_prompt_blocks" ON public.agent_prompt_blocks FOR DELETE USING (true);

-- Seed initial agents
INSERT INTO public.agents (name, type, model, temperature, max_tokens, base_system_prompt, behavior_config, orchestration_config) 
VALUES 
(
  'orchestrator',
  'orchestrator',
  'gpt-4o-mini',
  0.3,
  500,
  'You are the Intent Classifier for a restaurant ordering system. Your sole responsibility is to analyze conversation context and classify user intent. You DO NOT generate natural language responses. You ONLY output structured intent classification.',
  '{
    "customer_profile": {
      "auto_load": true,
      "update_name_from_conversation": true,
      "update_address_on_confirmation": true,
      "update_payment_on_confirmation": true
    },
    "pending_products": {
      "allow_multiple": true,
      "expiration_minutes": 15
    }
  }'::jsonb,
  '{
    "intents": {
      "browse_product": {"allowed_tools": [], "decision_hint": "User mentions a specific product by name"},
      "browse_menu": {"allowed_tools": [], "decision_hint": "User wants to see all available options"},
      "confirm_item": {"allowed_tools": [], "decision_hint": "User confirms a product that was just offered"},
      "provide_address": {"allowed_tools": [], "decision_hint": "User provides delivery address"},
      "provide_payment": {"allowed_tools": [], "decision_hint": "User selects payment method"},
      "finalize": {"allowed_tools": [], "decision_hint": "User wants to complete the order"},
      "ask_question": {"allowed_tools": [], "decision_hint": "User asks an informational question"},
      "collect_customer_data": {"allowed_tools": [], "decision_hint": "User provides personal information"},
      "manage_pending_items": {"allowed_tools": [], "decision_hint": "User mentions multiple products"},
      "confirm_pending_items": {"allowed_tools": [], "decision_hint": "User confirms list of pending products"}
    }
  }'::jsonb
),
(
  'conversational_ai',
  'assistant',
  'gpt-4o-mini',
  0.7,
  1000,
  'You are the main conversational AI for a restaurant. Your job is to talk naturally to customers in Portuguese, manage their orders, and call tools when appropriate.',
  '{
    "customer_profile": {
      "auto_load": true,
      "update_name_from_conversation": true,
      "update_address_on_confirmation": true,
      "update_payment_on_confirmation": true
    },
    "pending_products": {
      "allow_multiple": true,
      "expiration_minutes": 15
    }
  }'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Seed initial prompt blocks for orchestrator
INSERT INTO public.agent_prompt_blocks (agent_id, title, content, ordering, is_locked)
SELECT 
  a.id,
  'Core Classification Rules',
  'You must ALWAYS output exactly this JSON structure: {"intent": "...", "target_state": "...", "confidence": 0.0-1.0, "reasoning": "..."}. Never output plain text.',
  0,
  true
FROM public.agents a WHERE a.name = 'orchestrator'
ON CONFLICT DO NOTHING;

INSERT INTO public.agent_prompt_blocks (agent_id, title, content, ordering, is_locked)
SELECT 
  a.id,
  'Intent Definitions',
  'Analyze user messages to classify into intents: browse_product, browse_menu, confirm_item, provide_address, provide_payment, finalize, ask_question, collect_customer_data, manage_pending_items, confirm_pending_items, unclear.',
  1,
  false
FROM public.agents a WHERE a.name = 'orchestrator'
ON CONFLICT DO NOTHING;

-- Seed initial prompt blocks for conversational AI
INSERT INTO public.agent_prompt_blocks (agent_id, title, content, ordering, is_locked)
SELECT 
  a.id,
  'Core Behavior',
  'You are a friendly, helpful AI assistant for a restaurant. Speak naturally in Portuguese using "tu" form. Be concise (2-3 sentences max). Always confirm actions you take.',
  0,
  true
FROM public.agents a WHERE a.name = 'conversational_ai'
ON CONFLICT DO NOTHING;

INSERT INTO public.agent_prompt_blocks (agent_id, title, content, ordering, is_locked)
SELECT 
  a.id,
  'Customer Profile Logic',
  'Always check customer profile first. If customer has saved address/payment, confirm before collecting again. Call update_customer_profile when user provides new personal information.',
  1,
  false
FROM public.agents a WHERE a.name = 'conversational_ai'
ON CONFLICT DO NOTHING;

INSERT INTO public.agent_prompt_blocks (agent_id, title, content, ordering, is_locked)
SELECT 
  a.id,
  'Pending Products Logic',
  'When user mentions MULTIPLE products, use add_pending_item for each, then ask for confirmation. Only after confirmation, call confirm_pending_items to move to cart.',
  2,
  false
FROM public.agents a WHERE a.name = 'conversational_ai'
ON CONFLICT DO NOTHING;

-- Seed tools for conversational AI
INSERT INTO public.agent_tools (agent_id, tool_name, enabled, ordering, usage_rules)
SELECT 
  a.id,
  tool_name,
  true,
  ordering,
  rules
FROM public.agents a 
CROSS JOIN (
  VALUES 
    ('add_to_cart', 0, 'Use when user explicitly requests a SINGLE product OR confirms a pending product. Check for addons first.'),
    ('remove_from_cart', 1, 'Use when user wants to remove a product from their cart.'),
    ('set_delivery_address', 2, 'Use when user provides delivery address details.'),
    ('set_payment_method', 3, 'Use when user selects payment method (cash, card, mbway).'),
    ('finalize_order', 4, 'Use when user is ready to complete the order and all required info is collected.'),
    ('update_customer_profile', 5, 'Use when user provides name, address, or payment preference to save for future orders.'),
    ('add_pending_item', 6, 'Use when user mentions multiple products or is browsing without clear confirmation.'),
    ('clear_pending_items', 7, 'Use when user wants to cancel pending items selection.'),
    ('confirm_pending_items', 8, 'Use when user confirms the list of pending products to add them all to cart.')
) AS t(tool_name, ordering, rules)
WHERE a.name = 'conversational_ai'
ON CONFLICT DO NOTHING;