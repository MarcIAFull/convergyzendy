export interface Agent {
  id: string;
  name: string;
  type: 'orchestrator' | 'assistant';
  model: string;
  temperature: number;
  max_tokens: number;
  top_p: number | null;
  frequency_penalty: number | null;
  presence_penalty: number | null;
  base_system_prompt: string;
  is_active: boolean;
  behavior_config: BehaviorConfig;
  orchestration_config: OrchestrationConfig;
  created_at: string;
  updated_at: string;
}

export interface BehaviorConfig {
  customer_profile?: {
    auto_load?: boolean;
    update_name_from_conversation?: boolean;
    update_address_on_confirmation?: boolean;
    update_payment_on_confirmation?: boolean;
  };
  pending_products?: {
    allow_multiple?: boolean;
    expiration_minutes?: number;
  };
}

export interface OrchestrationConfig {
  intents?: {
    [intentName: string]: {
      allowed_tools: string[];
      decision_hint: string;
    };
  };
}

export interface AgentTool {
  id: string;
  agent_id: string;
  tool_name: string;
  enabled: boolean;
  ordering: number;
  description_override: string | null;
  usage_rules: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentPromptBlock {
  id: string;
  agent_id: string;
  title: string;
  content: string;
  ordering: number;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export const AVAILABLE_TOOLS = [
  {
    name: 'add_to_cart',
    label: 'Add to Cart',
    description: 'Add a product to the shopping cart'
  },
  {
    name: 'remove_from_cart',
    label: 'Remove from Cart',
    description: 'Remove a product from the cart'
  },
  {
    name: 'set_delivery_address',
    label: 'Set Delivery Address',
    description: 'Set or update the delivery address'
  },
  {
    name: 'set_payment_method',
    label: 'Set Payment Method',
    description: 'Set the payment method (cash, card, mbway)'
  },
  {
    name: 'finalize_order',
    label: 'Finalize Order',
    description: 'Complete and submit the order'
  },
  {
    name: 'update_customer_profile',
    label: 'Update Customer Profile',
    description: 'Save customer information for future orders'
  },
  {
    name: 'add_pending_item',
    label: 'Add Pending Item',
    description: 'Add product to pending items list (before cart)'
  },
  {
    name: 'clear_pending_items',
    label: 'Clear Pending Items',
    description: 'Clear all pending items'
  },
  {
    name: 'confirm_pending_items',
    label: 'Confirm Pending Items',
    description: 'Move all pending items to cart'
  }
] as const;

export const AVAILABLE_MODELS = [
  { value: 'gpt-5-2025-08-07', label: 'GPT-5 (Flagship)' },
  { value: 'gpt-5-mini-2025-08-07', label: 'GPT-5 Mini (Fast & Efficient)' },
  { value: 'gpt-5-nano-2025-08-07', label: 'GPT-5 Nano (Fastest)' },
  { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1 (Reliable)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Legacy)' },
  { value: 'gpt-4o', label: 'GPT-4o (Legacy)' }
] as const;

export const DEFAULT_INTENTS = [
  'browse_product',
  'browse_menu',
  'confirm_item',
  'provide_address',
  'provide_payment',
  'finalize',
  'ask_question',
  'collect_customer_data',
  'manage_pending_items',
  'confirm_pending_items',
  'modify_cart',
  'unclear'
] as const;
