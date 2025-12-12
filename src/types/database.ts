// Database entity types
export interface Restaurant {
  id: string;
  user_id: string;
  name: string;
  address: string;
  phone: string;
  opening_hours: OpeningHours;
  delivery_fee: number;
  is_open: boolean;
  latitude: number | null;
  longitude: number | null;
  google_place_id?: string | null;
  slug?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpeningHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface DayHours {
  open: string;
  close: string;
  closed?: boolean;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  search_keywords: string[];
  ingredients: string[];
  created_at: string;
  updated_at: string;
}

export interface Addon {
  id: string;
  product_id: string;
  name: string;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  default_address: Record<string, any> | null;
  default_payment_method: 'cash' | 'card' | 'mbway' | 'multibanco' | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ConversationPendingItem {
  id: string;
  user_phone: string;
  restaurant_id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'discarded';
  created_at: string;
  updated_at: string;
}

export interface Cart {
  id: string;
  user_phone: string;
  restaurant_id: string;
  status: 'active' | 'completed' | 'abandoned';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItemAddon {
  id: string;
  cart_item_id: string;
  addon_id: string;
  created_at: string;
}

export interface Order {
  id: string;
  cart_id: string;
  restaurant_id: string;
  user_phone: string;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'mbway' | 'multibanco';
  delivery_address: string;
  order_notes: string | null;
  status: 'new' | 'preparing' | 'out_for_delivery' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  restaurant_id: string;
  from_number: string;
  to_number: string;
  body: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
}

export interface CustomerInsight {
  phone: string;
  preferred_items: Array<{ id: string; name: string; count: number }>;
  preferred_addons: Array<{ id: string; name: string; count: number }>;
  rejected_items: Array<{ id: string; name: string; count: number }>;
  average_ticket: number | null;
  order_count: number;
  order_frequency_days: number | null;
  last_order_id: string | null;
  last_interaction_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
export interface ProductWithAddons extends Product {
  addons: Addon[];
}

export interface CategoryWithProducts extends Category {
  products: ProductWithAddons[];
}

export interface CartItemWithDetails extends CartItem {
  product: Product;
  addons: Addon[];
}

export interface CartWithItems extends Cart {
  items: CartItemWithDetails[];
}

export interface OrderWithDetails extends Order {
  items: CartItemWithDetails[];
  customer?: { phone: string; name: string | null } | null;
}

export interface ConversationPendingItemWithDetails extends ConversationPendingItem {
  product: Product;
}

// Agent Configuration Types
export interface AgentDB {
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
  behavior_config: any;
  orchestration_config: any;
  created_at: string;
  updated_at: string;
}

export interface AgentToolDB {
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

export interface AgentPromptBlockDB {
  id: string;
  agent_id: string;
  title: string;
  content: string;
  ordering: number;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

