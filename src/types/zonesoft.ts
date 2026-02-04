// ZoneSoft POS Integration Types

export interface ZoneSoftConfig {
  id: string;
  restaurant_id: string;
  enabled: boolean;
  
  // API Credentials
  client_id: string | null;
  app_key: string | null;
  app_secret: string | null;
  
  // Store Configuration
  store_id: number | null;
  warehouse_id: number | null;
  operator_id: number | null;
  document_type: string;
  document_series: string | null;
  payment_type_id: number;
  
  // Sync Settings
  products_synced_at: string | null;
  sync_mode: 'manual' | 'auto';
  
  // Metadata
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZoneSoftProductMapping {
  id: string;
  restaurant_id: string;
  local_product_id: string;
  zonesoft_product_id: number;
  zonesoft_product_code: string | null;
  zonesoft_product_name: string | null;
  last_synced_at: string;
}

export interface ZoneSoftSyncLog {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  action: 'send_order' | 'sync_products' | 'get_document';
  status: 'success' | 'error' | 'pending';
  zonesoft_document_number: number | null;
  zonesoft_document_type: string | null;
  zonesoft_document_series: string | null;
  request_body: unknown;
  response_body: unknown;
  error_message: string | null;
  created_at: string;
}

// ZoneSoft API Types

export interface ZoneSoftProduct {
  codigo: number;
  descricao: string;
  preco: number;
  unidade?: string;
  iva?: number;
  familia?: string;
  subfamilia?: string;
}

export interface ZoneSoftDocumentLine {
  codigo?: number;           // Product code in ZoneSoft
  descricao: string;         // Product description
  qtd: number;               // Quantity
  punit: number;             // Unit price
  iva?: number;              // VAT percentage
  total: number;             // Line total
  desconto?: number;         // Discount percentage
  obs?: string;              // Line notes
}

export interface ZoneSoftDocument {
  doc: string;               // Document type (TK, VD, etc)
  serie?: string;            // Document series
  loja: number;              // Store ID
  armazem?: number;          // Warehouse ID
  cliente?: number;          // Customer ID (0 = anonymous)
  nome?: string;             // Customer name
  telefone?: string;         // Customer phone
  morada?: string;           // Delivery address
  pagamento?: number;        // Payment type ID
  emp?: number;              // Operator ID
  data?: string;             // Date (YYYY-MM-DD)
  datahora?: string;         // DateTime (YYYY-MM-DD HH:mm:ss)
  observacoes?: string;      // Order notes
  ivaincluido?: number;      // VAT included (1 = yes)
  vendas: ZoneSoftDocumentLine[];
}

export interface ZoneSoftAPIResponse {
  success: boolean;
  data?: {
    document?: {
      numero: number;
      serie: string;
      doc: string;
    };
    products?: ZoneSoftProduct[];
  };
  error?: string;
  errorCode?: string;
}

// Document Types
export const ZONESOFT_DOCUMENT_TYPES = [
  { value: 'TK', label: 'Ticket' },
  { value: 'VD', label: 'Venda a Dinheiro' },
  { value: 'FR', label: 'Fatura-Recibo' },
  { value: 'FT', label: 'Fatura' },
  { value: 'NC', label: 'Nota de Crédito' },
] as const;

// Payment Types (common defaults, may vary by installation)
export const ZONESOFT_PAYMENT_TYPES = [
  { value: 1, label: 'Numerário' },
  { value: 2, label: 'Multibanco' },
  { value: 3, label: 'MBWay' },
  { value: 4, label: 'Transferência' },
  { value: 5, label: 'Crédito' },
] as const;
