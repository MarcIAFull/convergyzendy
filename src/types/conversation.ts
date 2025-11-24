import type { Cart, CartItem, Product, Addon, Customer } from './database';

export interface EnrichedConversation {
  userPhone: string;
  customerName: string | null;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  conversationState: string;
  mode: 'ai' | 'manual';
  hasActiveCart: boolean;
  isOnline: boolean;
}

export interface CustomerDetails {
  phone: string;
  name: string | null;
  conversationState: string;
  lastInteraction: string;
  cart: CartWithItems | null;
}

export interface CartItemWithDetails extends CartItem {
  product: Product;
  addons: Addon[];
}

export interface CartWithItems extends Cart {
  items: CartItemWithDetails[];
}

export const conversationStateConfig = {
  idle: { label: 'Inativo', color: 'bg-muted text-muted-foreground' },
  browsing_menu: { label: 'Vendo Menu', color: 'bg-blue-500/10 text-blue-500' },
  asking_details: { label: 'Escolhendo', color: 'bg-purple-500/10 text-purple-500' },
  collecting_payment: { label: 'Definindo Pagamento', color: 'bg-yellow-500/10 text-yellow-500' },
  collecting_address: { label: 'Definindo Endereço', color: 'bg-orange-500/10 text-orange-500' },
  confirming_order: { label: 'Montando Pedido', color: 'bg-primary/10 text-primary' },
  order_placed: { label: 'Pedido Realizado', color: 'bg-success/10 text-success' },
} as const;
