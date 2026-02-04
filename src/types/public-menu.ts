// Types para o Menu Público

import { Product, Addon, Category } from './database';
import { Tables } from '@/integrations/supabase/types';

export type Restaurant = Tables<'restaurants'>;

export interface RestaurantSettings {
  id: string;
  restaurant_id: string;
  menu_enabled: boolean;
  slug: string;
  custom_domain: string | null;
  
  // Branding
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  accent_color: string;
  
  // Configurações de Pedido
  min_order_amount: number;
  max_delivery_distance_km: number;
  estimated_prep_time_minutes: number;
  
  // Formas de Finalização
  checkout_whatsapp_enabled: boolean;
  checkout_web_enabled: boolean;
  
  // SEO
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string[] | null;
  
  // Social
  instagram_url: string | null;
  facebook_url: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface PublicMenuData {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  categories: Category[];
  products: Product[];
  addons: Addon[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedAddons: Addon[];
  notes: string;
  totalPrice: number;
}

export interface DeliveryAddress {
  formatted_address: string;
  lat: number | null;
  lng: number | null;
  instructions: string;
}

export interface CheckoutData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: DeliveryAddress;
  payment_method: 'cash' | 'card' | 'pix' | 'mbway' | 'multibanco';
  change_for?: number;
}

export type OrderType = 'delivery' | 'dine_in' | 'takeaway';

export interface WebOrder {
  id: string;
  restaurant_id: string;
  cart_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_instructions: string | null;
  items: any;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  source: string;
  order_type: OrderType;
  table_number: string | null;
  created_at: string;
}
