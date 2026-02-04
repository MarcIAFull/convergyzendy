// Glovo LaaS API Types

export interface GlovoConfig {
  id: string;
  restaurant_id: string;
  enabled: boolean;
  client_id: string | null;
  client_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  address_book_id: string | null;
  pickup_address: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  pickup_phone: string | null;
  webhook_secret: string | null;
  environment: 'staging' | 'production';
  created_at: string;
  updated_at: string;
}

export interface GlovoDelivery {
  id: string;
  order_id: string;
  restaurant_id: string;
  tracking_number: string;
  order_code: string | null;
  quote_id: string | null;
  quote_price: number | null;
  final_fee: number | null;
  status: GlovoDeliveryStatus;
  courier_name: string | null;
  courier_phone: string | null;
  courier_latitude: number | null;
  courier_longitude: number | null;
  tracking_link: string | null;
  estimated_pickup_at: string | null;
  estimated_delivery_at: string | null;
  picked_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  raw_response: unknown;
  created_at: string;
  updated_at: string;
}

export type GlovoDeliveryStatus = 
  | 'CREATED'
  | 'ACCEPTED'
  | 'WAITING_FOR_PICKUP'
  | 'PICKED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'EXPIRED';

// API Request/Response types
export interface GlovoQuoteRequest {
  orderId: string;
  pickupAddress: {
    latitude: number;
    longitude: number;
    address: string;
    details?: string;
  };
  deliveryAddress: {
    latitude: number;
    longitude: number;
    address: string;
    details?: string;
  };
}

export interface GlovoQuoteResponse {
  quoteId: string;
  estimatedPrice: number;
  currency: string;
  estimatedPickupTime: string;
  estimatedDeliveryTime: string;
  expiresAt: string;
}

export interface GlovoCreateDeliveryRequest {
  quoteId: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  orderDescription?: string;
  pickupInstructions?: string;
  deliveryInstructions?: string;
}

export interface GlovoCreateDeliveryResponse {
  trackingNumber: string;
  orderCode: string;
  status: GlovoDeliveryStatus;
  trackingLink: string;
  estimatedPickupAt: string;
  estimatedDeliveryAt: string;
}

export interface GlovoCourierInfo {
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  eta: string;
}

export interface GlovoWebhookPayload {
  type: 'STATUS_UPDATE' | 'POSITION_UPDATE';
  trackingNumber: string;
  orderCode?: string;
  status?: GlovoDeliveryStatus;
  courier?: GlovoCourierInfo;
  timestamp: string;
}

// Store types
export interface GlovoQuote {
  quoteId: string;
  price: number;
  currency: string;
  estimatedPickup: Date;
  estimatedDelivery: Date;
  expiresAt: Date;
}
