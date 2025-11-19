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

export interface Cart {
  id: string;
  user_phone: string;
  restaurant_id: string;
  status: 'active' | 'completed' | 'abandoned';
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
}
