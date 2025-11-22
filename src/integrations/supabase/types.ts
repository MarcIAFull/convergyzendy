export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      addons: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_prompt_blocks: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          id: string
          is_locked: boolean
          ordering: number
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string
          id?: string
          is_locked?: boolean
          ordering?: number
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          ordering?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_prompt_blocks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tools: {
        Row: {
          agent_id: string
          created_at: string
          description_override: string | null
          enabled: boolean
          id: string
          ordering: number
          tool_name: string
          updated_at: string
          usage_rules: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          description_override?: string | null
          enabled?: boolean
          id?: string
          ordering?: number
          tool_name: string
          updated_at?: string
          usage_rules?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          description_override?: string | null
          enabled?: boolean
          id?: string
          ordering?: number
          tool_name?: string
          updated_at?: string
          usage_rules?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_tools_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          base_system_prompt: string
          behavior_config: Json | null
          created_at: string
          frequency_penalty: number | null
          id: string
          is_active: boolean
          max_tokens: number
          model: string
          name: string
          orchestration_config: Json | null
          presence_penalty: number | null
          recovery_config: Json | null
          temperature: number
          top_p: number | null
          type: string
          updated_at: string
        }
        Insert: {
          base_system_prompt: string
          behavior_config?: Json | null
          created_at?: string
          frequency_penalty?: number | null
          id?: string
          is_active?: boolean
          max_tokens?: number
          model?: string
          name: string
          orchestration_config?: Json | null
          presence_penalty?: number | null
          recovery_config?: Json | null
          temperature?: number
          top_p?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          base_system_prompt?: string
          behavior_config?: Json | null
          created_at?: string
          frequency_penalty?: number | null
          id?: string
          is_active?: boolean
          max_tokens?: number
          model?: string
          name?: string
          orchestration_config?: Json | null
          presence_penalty?: number | null
          recovery_config?: Json | null
          temperature?: number
          top_p?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      cart_item_addons: {
        Row: {
          addon_id: string
          cart_item_id: string
          created_at: string
          id: string
        }
        Insert: {
          addon_id: string
          cart_item_id: string
          created_at?: string
          id?: string
        }
        Update: {
          addon_id?: string
          cart_item_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_item_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_item_addons_cart_item_id_fkey"
            columns: ["cart_item_id"]
            isOneToOne: false
            referencedRelation: "cart_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          restaurant_id: string
          status: string
          updated_at: string
          user_phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          restaurant_id: string
          status?: string
          updated_at?: string
          user_phone: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          restaurant_id?: string
          status?: string
          updated_at?: string
          user_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          restaurant_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_recovery_attempts: {
        Row: {
          attempt_number: number | null
          cart_id: string | null
          cart_value: number | null
          conversation_state_id: string | null
          created_at: string | null
          customer_name: string | null
          id: string
          items_count: number | null
          last_state: string | null
          max_attempts: number | null
          message_sent: string | null
          metadata: Json | null
          next_attempt_at: string | null
          recovered_at: string | null
          recovery_type: string
          restaurant_id: string
          scheduled_for: string
          sent_at: string | null
          status: string | null
          updated_at: string | null
          user_phone: string
        }
        Insert: {
          attempt_number?: number | null
          cart_id?: string | null
          cart_value?: number | null
          conversation_state_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string
          items_count?: number | null
          last_state?: string | null
          max_attempts?: number | null
          message_sent?: string | null
          metadata?: Json | null
          next_attempt_at?: string | null
          recovered_at?: string | null
          recovery_type: string
          restaurant_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_phone: string
        }
        Update: {
          attempt_number?: number | null
          cart_id?: string | null
          cart_value?: number | null
          conversation_state_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string
          items_count?: number | null
          last_state?: string | null
          max_attempts?: number | null
          message_sent?: string | null
          metadata?: Json | null
          next_attempt_at?: string | null
          recovered_at?: string | null
          recovery_type?: string
          restaurant_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_recovery_attempts_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_recovery_attempts_conversation_state_id_fkey"
            columns: ["conversation_state_id"]
            isOneToOne: false
            referencedRelation: "conversation_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_recovery_attempts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_state: {
        Row: {
          cart_id: string | null
          created_at: string
          id: string
          last_shown_products: Json | null
          metadata: Json | null
          restaurant_id: string
          state: string
          updated_at: string
          user_phone: string
        }
        Insert: {
          cart_id?: string | null
          created_at?: string
          id?: string
          last_shown_products?: Json | null
          metadata?: Json | null
          restaurant_id: string
          state?: string
          updated_at?: string
          user_phone: string
        }
        Update: {
          cart_id?: string | null
          created_at?: string
          id?: string
          last_shown_products?: Json | null
          metadata?: Json | null
          restaurant_id?: string
          state?: string
          updated_at?: string
          user_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_state_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_state_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_insights: {
        Row: {
          average_ticket: number | null
          created_at: string | null
          last_interaction_at: string | null
          last_order_id: string | null
          notes: string | null
          order_count: number | null
          order_frequency_days: number | null
          phone: string
          preferred_addons: Json | null
          preferred_items: Json | null
          rejected_items: Json | null
          updated_at: string | null
        }
        Insert: {
          average_ticket?: number | null
          created_at?: string | null
          last_interaction_at?: string | null
          last_order_id?: string | null
          notes?: string | null
          order_count?: number | null
          order_frequency_days?: number | null
          phone: string
          preferred_addons?: Json | null
          preferred_items?: Json | null
          rejected_items?: Json | null
          updated_at?: string | null
        }
        Update: {
          average_ticket?: number | null
          created_at?: string | null
          last_interaction_at?: string | null
          last_order_id?: string | null
          notes?: string | null
          order_count?: number | null
          order_frequency_days?: number | null
          phone?: string
          preferred_addons?: Json | null
          preferred_items?: Json | null
          rejected_items?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          default_address: Json | null
          default_payment_method: string | null
          id: string
          metadata: Json | null
          name: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_address?: Json | null
          default_payment_method?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_address?: Json | null
          default_payment_method?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          direction: string
          from_number: string
          id: string
          restaurant_id: string
          timestamp: string
          to_number: string
        }
        Insert: {
          body: string
          direction: string
          from_number: string
          id?: string
          restaurant_id: string
          timestamp?: string
          to_number: string
        }
        Update: {
          body?: string
          direction?: string
          from_number?: string
          id?: string
          restaurant_id?: string
          timestamp?: string
          to_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cart_id: string
          created_at: string
          delivery_address: string
          id: string
          order_notes: string | null
          payment_method: string
          restaurant_id: string
          status: string
          total_amount: number
          updated_at: string
          user_phone: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          delivery_address: string
          id?: string
          order_notes?: string | null
          payment_method: string
          restaurant_id: string
          status?: string
          total_amount: number
          updated_at?: string
          user_phone: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          delivery_address?: string
          id?: string
          order_notes?: string | null
          payment_method?: string
          restaurant_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string
          created_at: string
          delivery_fee: number
          id: string
          is_open: boolean
          name: string
          opening_hours: Json | null
          phone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: string
          created_at?: string
          delivery_fee?: number
          id?: string
          is_open?: boolean
          name: string
          opening_hours?: Json | null
          phone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          delivery_fee?: number
          id?: string
          is_open?: boolean
          name?: string
          opening_hours?: Json | null
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      detect_abandoned_carts: {
        Args: { p_delay_minutes?: number; p_restaurant_id: string }
        Returns: {
          cart_id: string
          cart_value: number
          customer_name: string
          items_count: number
          minutes_since_activity: number
          user_phone: string
        }[]
      }
      detect_inactive_customers: {
        Args: { p_delay_days?: number; p_restaurant_id: string }
        Returns: {
          customer_name: string
          days_since_last_order: number
          order_count: number
          preferred_items: Json
          user_phone: string
        }[]
      }
      detect_paused_conversations: {
        Args: { p_delay_minutes?: number; p_restaurant_id: string }
        Returns: {
          conversation_state_id: string
          customer_name: string
          last_state: string
          minutes_since_activity: number
          user_phone: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
