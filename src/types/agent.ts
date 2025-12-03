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
  recovery_config?: RecoveryConfig;
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

export interface RecoveryConfig {
  enabled: boolean;
  types: {
    cart_abandoned: {
      enabled: boolean;
      delay_minutes: number;
      max_attempts: number;
      message_template: string;
    };
    conversation_paused: {
      enabled: boolean;
      delay_minutes: number;
      max_attempts: number;
      message_template: string;
    };
    customer_inactive: {
      enabled: boolean;
      delay_days: number;
      max_attempts: number;
      message_template: string;
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
    description: 'Add a product to the shopping cart',
    parameters: {
      product_id: { type: 'string', required: true, description: 'Product UUID' },
      quantity: { type: 'number', required: false, description: 'Quantity (default 1)' },
      addon_ids: { type: 'array', required: false, description: 'Addon UUIDs' },
      notes: { type: 'string', required: false, description: 'Special instructions' }
    }
  },
  {
    name: 'remove_from_cart',
    label: 'Remove from Cart',
    description: 'Remove a product from the cart',
    parameters: {
      product_id: { type: 'string', required: true, description: 'Product UUID to remove' }
    }
  },
  {
    name: 'clear_cart',
    label: 'Clear Cart',
    description: 'Clear all items from the customer\'s cart',
    parameters: {}
  },
  {
    name: 'show_cart',
    label: 'Show Cart',
    description: 'Display the current cart contents to the customer',
    parameters: {}
  },
  {
    name: 'search_menu',
    label: 'Search Menu',
    description: 'Search products by name, category, or description (handles typos)',
    parameters: {
      query: { type: 'string', required: true, description: 'Search term' },
      category: { type: 'string', required: false, description: 'Filter by category' },
      max_results: { type: 'number', required: false, description: 'Max results (default 5)' }
    }
  },
  {
    name: 'set_delivery_address',
    label: 'Set Delivery Address',
    description: 'Set or update the delivery address',
    parameters: {
      address: { type: 'string', required: true, description: 'Full delivery address' }
    }
  },
  {
    name: 'set_payment_method',
    label: 'Set Payment Method',
    description: 'Set the payment method (cash, card, mbway)',
    parameters: {
      method: { type: 'string', required: true, description: 'Payment method', enum: ['cash', 'card', 'mbway'] }
    }
  },
  {
    name: 'finalize_order',
    label: 'Finalize Order',
    description: 'Complete and submit the order',
    parameters: {}
  },
  {
    name: 'update_customer_profile',
    label: 'Update Customer Profile',
    description: 'Save customer information for future orders',
    parameters: {
      name: { type: 'string', required: false, description: 'Customer name' },
      default_address: { type: 'object', required: false, description: 'Default address' },
      default_payment_method: { type: 'string', required: false, description: 'Default payment method' }
    }
  },
  {
    name: 'add_pending_item',
    label: 'Add Pending Item',
    description: 'Add product to pending items list (for multi-item orders)',
    parameters: {
      product_id: { type: 'string', required: true, description: 'Product UUID' },
      quantity: { type: 'number', required: false, description: 'Quantity (default 1)' },
      addon_ids: { type: 'array', required: false, description: 'Addon UUIDs' },
      notes: { type: 'string', required: false, description: 'Special instructions' }
    }
  },
  {
    name: 'remove_pending_item',
    label: 'Remove Pending Item',
    description: 'Remove or modify a pending item before confirmation',
    parameters: {
      product_id: { type: 'string', required: true, description: 'Product UUID' },
      action: { type: 'string', required: true, description: 'Action to perform', enum: ['remove_all', 'decrease_quantity'] },
      quantity_change: { type: 'number', required: false, description: 'Specific quantity to remove' }
    }
  },
  {
    name: 'clear_pending_items',
    label: 'Clear Pending Items',
    description: 'Discard all pending items without adding to cart',
    parameters: {}
  },
  {
    name: 'confirm_pending_items',
    label: 'Confirm Pending Items',
    description: 'Move all pending items to cart',
    parameters: {}
  },
  {
    name: 'get_customer_history',
    label: 'Get Customer History',
    description: 'Retrieve customer order history and preferences for personalization',
    parameters: {}
  },
  {
    name: 'send_menu_link',
    label: 'Send Menu Link',
    description: 'Send the public menu URL to the customer',
    parameters: {}
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
