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
      address_cache: {
        Row: {
          address_components: Json | null
          address_query: string
          created_at: string
          expires_at: string
          formatted_address: string
          google_place_id: string | null
          id: string
          latitude: number
          longitude: number
        }
        Insert: {
          address_components?: Json | null
          address_query: string
          created_at?: string
          expires_at?: string
          formatted_address: string
          google_place_id?: string | null
          id?: string
          latitude: number
          longitude: number
        }
        Update: {
          address_components?: Json | null
          address_query?: string
          created_at?: string
          expires_at?: string
          formatted_address?: string
          google_place_id?: string | null
          id?: string
          latitude?: number
          longitude?: number
        }
        Relationships: []
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
      ai_interaction_logs: {
        Row: {
          ai_request: Json | null
          ai_response_raw: Json | null
          ai_response_text: string | null
          context_loaded: Json | null
          conversation_id: string | null
          created_at: string
          customer_phone: string
          errors: Json | null
          final_response: string | null
          has_errors: boolean | null
          id: string
          log_level: string | null
          orchestrator_confidence: number | null
          orchestrator_intent: string | null
          orchestrator_reasoning: string | null
          orchestrator_target_state: string | null
          processing_time_ms: number | null
          prompt_length: number | null
          restaurant_id: string
          state_after: string | null
          state_before: string | null
          system_prompt: string | null
          tokens_used: number | null
          tool_calls_requested: Json | null
          tool_calls_validated: Json | null
          tool_execution_results: Json | null
          user_message: string
        }
        Insert: {
          ai_request?: Json | null
          ai_response_raw?: Json | null
          ai_response_text?: string | null
          context_loaded?: Json | null
          conversation_id?: string | null
          created_at?: string
          customer_phone: string
          errors?: Json | null
          final_response?: string | null
          has_errors?: boolean | null
          id?: string
          log_level?: string | null
          orchestrator_confidence?: number | null
          orchestrator_intent?: string | null
          orchestrator_reasoning?: string | null
          orchestrator_target_state?: string | null
          processing_time_ms?: number | null
          prompt_length?: number | null
          restaurant_id: string
          state_after?: string | null
          state_before?: string | null
          system_prompt?: string | null
          tokens_used?: number | null
          tool_calls_requested?: Json | null
          tool_calls_validated?: Json | null
          tool_execution_results?: Json | null
          user_message: string
        }
        Update: {
          ai_request?: Json | null
          ai_response_raw?: Json | null
          ai_response_text?: string | null
          context_loaded?: Json | null
          conversation_id?: string | null
          created_at?: string
          customer_phone?: string
          errors?: Json | null
          final_response?: string | null
          has_errors?: boolean | null
          id?: string
          log_level?: string | null
          orchestrator_confidence?: number | null
          orchestrator_intent?: string | null
          orchestrator_reasoning?: string | null
          orchestrator_target_state?: string | null
          processing_time_ms?: number | null
          prompt_length?: number | null
          restaurant_id?: string
          state_after?: string | null
          state_before?: string | null
          system_prompt?: string | null
          tokens_used?: number | null
          tool_calls_requested?: Json | null
          tool_calls_validated?: Json | null
          tool_execution_results?: Json | null
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_interaction_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      conversation_mode: {
        Row: {
          created_at: string
          handoff_reason: string | null
          handoff_summary: string | null
          id: string
          mode: string
          restaurant_id: string
          taken_over_at: string | null
          taken_over_by: string | null
          updated_at: string
          user_phone: string
        }
        Insert: {
          created_at?: string
          handoff_reason?: string | null
          handoff_summary?: string | null
          id?: string
          mode: string
          restaurant_id: string
          taken_over_at?: string | null
          taken_over_by?: string | null
          updated_at?: string
          user_phone: string
        }
        Update: {
          created_at?: string
          handoff_reason?: string | null
          handoff_summary?: string | null
          id?: string
          mode?: string
          restaurant_id?: string
          taken_over_at?: string | null
          taken_over_by?: string | null
          updated_at?: string
          user_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_mode_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_pending_items: {
        Row: {
          addon_ids: string[] | null
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          restaurant_id: string
          status: string
          updated_at: string
          user_phone: string
        }
        Insert: {
          addon_ids?: string[] | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          restaurant_id: string
          status?: string
          updated_at?: string
          user_phone: string
        }
        Update: {
          addon_ids?: string[] | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          restaurant_id?: string
          status?: string
          updated_at?: string
          user_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_pending_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_pending_items_restaurant_id_fkey"
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
          restaurant_id: string
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
          restaurant_id: string
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
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          coordinates: Json
          created_at: string
          fee_amount: number
          fee_type: string
          id: string
          is_active: boolean
          max_delivery_time_minutes: number | null
          min_order_amount: number | null
          name: string
          priority: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          coordinates: Json
          created_at?: string
          fee_amount?: number
          fee_type?: string
          id?: string
          is_active?: boolean
          max_delivery_time_minutes?: number | null
          min_order_amount?: number | null
          name: string
          priority?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          coordinates?: Json
          created_at?: string
          fee_amount?: number
          fee_type?: string
          id?: string
          is_active?: boolean
          max_delivery_time_minutes?: number | null
          min_order_amount?: number | null
          name?: string
          priority?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      distance_matrix_cache: {
        Row: {
          created_at: string
          destination_lat: number
          destination_lng: number
          distance_meters: number
          duration_seconds: number
          expires_at: string
          id: string
          origin_lat: number
          origin_lng: number
        }
        Insert: {
          created_at?: string
          destination_lat: number
          destination_lng: number
          distance_meters: number
          duration_seconds: number
          expires_at?: string
          id?: string
          origin_lat: number
          origin_lng: number
        }
        Update: {
          created_at?: string
          destination_lat?: number
          destination_lng?: number
          distance_meters?: number
          duration_seconds?: number
          expires_at?: string
          id?: string
          origin_lat?: number
          origin_lng?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number | null
          billing_address: Json | null
          billing_email: string | null
          billing_name: string | null
          billing_tax_id: string | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string | null
          invoice_pdf_url: string | null
          line_items: Json
          metadata: Json | null
          paid_at: string | null
          restaurant_id: string
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          billing_address?: Json | null
          billing_email?: string | null
          billing_name?: string | null
          billing_tax_id?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          line_items?: Json
          metadata?: Json | null
          paid_at?: string | null
          restaurant_id: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          billing_address?: Json | null
          billing_email?: string | null
          billing_name?: string | null
          billing_tax_id?: string | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          line_items?: Json
          metadata?: Json | null
          paid_at?: string | null
          restaurant_id?: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      message_debounce_queue: {
        Row: {
          created_at: string
          customer_phone: string
          error_message: string | null
          first_message_at: string
          id: string
          last_message_at: string
          messages: Json
          metadata: Json | null
          processed_at: string | null
          restaurant_id: string
          scheduled_process_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_phone: string
          error_message?: string | null
          first_message_at?: string
          id?: string
          last_message_at?: string
          messages?: Json
          metadata?: Json | null
          processed_at?: string | null
          restaurant_id: string
          scheduled_process_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_phone?: string
          error_message?: string | null
          first_message_at?: string
          id?: string
          last_message_at?: string
          messages?: Json
          metadata?: Json | null
          processed_at?: string | null
          restaurant_id?: string
          scheduled_process_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_debounce_queue_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          direction: string
          from_number: string
          id: string
          restaurant_id: string
          sent_by: string | null
          timestamp: string
          to_number: string
        }
        Insert: {
          body: string
          direction: string
          from_number: string
          id?: string
          restaurant_id: string
          sent_by?: string | null
          timestamp?: string
          to_number: string
        }
        Update: {
          body?: string
          direction?: string
          from_number?: string
          id?: string
          restaurant_id?: string
          sent_by?: string | null
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
      notification_preferences: {
        Row: {
          created_at: string | null
          id: string
          new_message_enabled: boolean | null
          new_order_enabled: boolean | null
          recovery_enabled: boolean | null
          sound_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          new_message_enabled?: boolean | null
          new_order_enabled?: boolean | null
          recovery_enabled?: boolean | null
          sound_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          new_message_enabled?: boolean | null
          new_order_enabled?: boolean | null
          recovery_enabled?: boolean | null
          sound_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      platform_admins: {
        Row: {
          access_level: string
          can_impersonate_users: boolean | null
          can_manage_platform_settings: boolean | null
          can_manage_subscriptions: boolean | null
          can_view_all_restaurants: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          can_impersonate_users?: boolean | null
          can_manage_platform_settings?: boolean | null
          can_manage_subscriptions?: boolean | null
          can_view_all_restaurants?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          access_level?: string
          can_impersonate_users?: boolean | null
          can_manage_platform_settings?: boolean | null
          can_manage_subscriptions?: boolean | null
          can_view_all_restaurants?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["user_id"]
          },
        ]
      }
      products: {
        Row: {
          allergens: string[] | null
          category_id: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_available: boolean
          is_featured: boolean | null
          name: string
          nutritional_info: Json | null
          price: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          allergens?: string[] | null
          category_id: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean | null
          name: string
          nutritional_info?: Json | null
          price: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          allergens?: string[] | null
          category_id?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean | null
          name?: string
          nutritional_info?: Json | null
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
      restaurant_ai_settings: {
        Row: {
          business_rules: string | null
          closing_message: string | null
          created_at: string
          custom_instructions: string | null
          faq_responses: string | null
          greeting_message: string | null
          id: string
          language: string
          max_additional_questions_before_checkout: number
          restaurant_id: string
          special_offers_info: string | null
          tone: string
          unavailable_items_handling: string | null
          updated_at: string
          upsell_aggressiveness: string
        }
        Insert: {
          business_rules?: string | null
          closing_message?: string | null
          created_at?: string
          custom_instructions?: string | null
          faq_responses?: string | null
          greeting_message?: string | null
          id?: string
          language?: string
          max_additional_questions_before_checkout?: number
          restaurant_id: string
          special_offers_info?: string | null
          tone?: string
          unavailable_items_handling?: string | null
          updated_at?: string
          upsell_aggressiveness?: string
        }
        Update: {
          business_rules?: string | null
          closing_message?: string | null
          created_at?: string
          custom_instructions?: string | null
          faq_responses?: string | null
          greeting_message?: string | null
          id?: string
          language?: string
          max_additional_questions_before_checkout?: number
          restaurant_id?: string
          special_offers_info?: string | null
          tone?: string
          unavailable_items_handling?: string | null
          updated_at?: string
          upsell_aggressiveness?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_ai_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_owners: {
        Row: {
          created_at: string | null
          id: string
          permissions: Json | null
          restaurant_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          restaurant_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          restaurant_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_owners_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_prompt_overrides: {
        Row: {
          block_key: string
          content: string
          created_at: string
          id: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          block_key: string
          content: string
          created_at?: string
          id?: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          block_key?: string
          content?: string
          created_at?: string
          id?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_prompt_overrides_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          accent_color: string | null
          banner_url: string | null
          checkout_web_enabled: boolean | null
          checkout_whatsapp_enabled: boolean | null
          created_at: string | null
          custom_domain: string | null
          estimated_prep_time_minutes: number | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          logo_url: string | null
          max_delivery_distance_km: number | null
          menu_enabled: boolean | null
          meta_description: string | null
          meta_keywords: string[] | null
          meta_title: string | null
          min_order_amount: number | null
          primary_color: string | null
          restaurant_id: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          banner_url?: string | null
          checkout_web_enabled?: boolean | null
          checkout_whatsapp_enabled?: boolean | null
          created_at?: string | null
          custom_domain?: string | null
          estimated_prep_time_minutes?: number | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          max_delivery_distance_km?: number | null
          menu_enabled?: boolean | null
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          min_order_amount?: number | null
          primary_color?: string | null
          restaurant_id: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          banner_url?: string | null
          checkout_web_enabled?: boolean | null
          checkout_whatsapp_enabled?: boolean | null
          created_at?: string | null
          custom_domain?: string | null
          estimated_prep_time_minutes?: number | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          max_delivery_distance_km?: number | null
          menu_enabled?: boolean | null
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          min_order_amount?: number | null
          primary_color?: string | null
          restaurant_id?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
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
          google_place_id: string | null
          id: string
          is_open: boolean
          latitude: number | null
          longitude: number | null
          name: string
          opening_hours: Json | null
          phone: string
          slug: string | null
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          delivery_fee?: number
          google_place_id?: string | null
          id?: string
          is_open?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_hours?: Json | null
          phone: string
          slug?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          delivery_fee?: number
          google_place_id?: string | null
          id?: string
          is_open?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_hours?: Json | null
          phone?: string
          slug?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          metadata: Json | null
          orders_limit: number | null
          orders_used: number | null
          plan_name: string
          restaurant_id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string
          stripe_subscription_id: string | null
          token_alerts_sent: Json | null
          tokens_limit: number | null
          tokens_reset_at: string | null
          tokens_used: number | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          users_limit: number | null
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string | null
          current_period_end: string
          current_period_start: string
          id?: string
          metadata?: Json | null
          orders_limit?: number | null
          orders_used?: number | null
          plan_name: string
          restaurant_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id: string
          stripe_subscription_id?: string | null
          token_alerts_sent?: Json | null
          tokens_limit?: number | null
          tokens_reset_at?: string | null
          tokens_used?: number | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          users_limit?: number | null
        }
        Update: {
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          metadata?: Json | null
          orders_limit?: number | null
          orders_used?: number | null
          plan_name?: string
          restaurant_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string
          stripe_subscription_id?: string | null
          token_alerts_sent?: Json | null
          tokens_limit?: number | null
          tokens_reset_at?: string | null
          tokens_used?: number | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          users_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          created_at: string | null
          id: string
          log_type: string
          message: string
          metadata: Json | null
          restaurant_id: string | null
          severity: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          log_type: string
          message: string
          metadata?: Json | null
          restaurant_id?: string | null
          severity?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          log_type?: string
          message?: string
          metadata?: Json | null
          restaurant_id?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          permissions: Json | null
          restaurant_id: string
          role: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          permissions?: Json | null
          restaurant_id: string
          role?: string
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          permissions?: Json | null
          restaurant_id?: string
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          created_at: string | null
          currency: string | null
          custom_css: string | null
          custom_domain: string | null
          custom_favicon_url: string | null
          custom_logo_url: string | null
          domain_verified: boolean | null
          email_from_name: string | null
          email_reply_to: string | null
          id: string
          locale: string | null
          primary_color: string | null
          restaurant_id: string
          sms_sender_name: string | null
          subdomain: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          custom_css?: string | null
          custom_domain?: string | null
          custom_favicon_url?: string | null
          custom_logo_url?: string | null
          domain_verified?: boolean | null
          email_from_name?: string | null
          email_reply_to?: string | null
          id?: string
          locale?: string | null
          primary_color?: string | null
          restaurant_id: string
          sms_sender_name?: string | null
          subdomain?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          custom_css?: string | null
          custom_domain?: string | null
          custom_favicon_url?: string | null
          custom_logo_url?: string | null
          domain_verified?: boolean | null
          email_from_name?: string | null
          email_reply_to?: string | null
          id?: string
          locale?: string | null
          primary_color?: string | null
          restaurant_id?: string
          sms_sender_name?: string | null
          subdomain?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      token_usage_daily: {
        Row: {
          avg_tokens_per_interaction: number | null
          completion_tokens: number | null
          created_at: string | null
          date: string
          estimated_cost_usd: number | null
          id: string
          prompt_tokens: number | null
          restaurant_id: string
          tokens_by_model: Json | null
          total_interactions: number | null
          total_tokens: number | null
          updated_at: string | null
        }
        Insert: {
          avg_tokens_per_interaction?: number | null
          completion_tokens?: number | null
          created_at?: string | null
          date: string
          estimated_cost_usd?: number | null
          id?: string
          prompt_tokens?: number | null
          restaurant_id: string
          tokens_by_model?: Json | null
          total_interactions?: number | null
          total_tokens?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_tokens_per_interaction?: number | null
          completion_tokens?: number | null
          created_at?: string | null
          date?: string
          estimated_cost_usd?: number | null
          id?: string
          prompt_tokens?: number | null
          restaurant_id?: string
          tokens_by_model?: Json | null
          total_interactions?: number | null
          total_tokens?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_daily_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          quantity: number | null
          restaurant_id: string
          subscription_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          quantity?: number | null
          restaurant_id: string
          subscription_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          quantity?: number | null
          restaurant_id?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      web_orders: {
        Row: {
          cart_id: string
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_fee: number
          delivery_instructions: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          id: string
          ip_address: unknown
          items: Json
          payment_method: string
          payment_status: string | null
          restaurant_id: string
          source: string | null
          status: string | null
          subtotal: number
          total_amount: number
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_fee: number
          delivery_instructions?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          id?: string
          ip_address?: unknown
          items: Json
          payment_method: string
          payment_status?: string | null
          restaurant_id: string
          source?: string | null
          status?: string | null
          subtotal: number
          total_amount: number
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: string
          delivery_fee?: number
          delivery_instructions?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          id?: string
          ip_address?: unknown
          items?: Json
          payment_method?: string
          payment_status?: string | null
          restaurant_id?: string
          source?: string | null
          status?: string | null
          subtotal?: number
          total_amount?: number
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_orders_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string | null
          id: string
          instance_name: string
          last_checked_at: string | null
          last_connected_at: string | null
          metadata: Json | null
          phone_number: string | null
          qr_code: string | null
          qr_code_base64: string | null
          restaurant_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_name: string
          last_checked_at?: string | null
          last_connected_at?: string | null
          metadata?: Json | null
          phone_number?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          restaurant_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_name?: string
          last_checked_at?: string | null
          last_connected_at?: string | null
          metadata?: Json | null
          phone_number?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          restaurant_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aggregate_daily_token_usage: {
        Args: { p_date?: string }
        Returns: undefined
      }
      cleanup_expired_caches: { Args: never; Returns: undefined }
      create_restaurant_with_owner: {
        Args: {
          p_address: string
          p_delivery_fee: number
          p_name: string
          p_opening_hours?: Json
          p_phone: string
        }
        Returns: Json
      }
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
      generate_unique_slug: {
        Args: { restaurant_name: string }
        Returns: string
      }
      get_current_user_id: { Args: never; Returns: string }
      get_restaurant_by_instance: {
        Args: { instance_name: string }
        Returns: string
      }
      get_team_members_with_email: {
        Args: { p_restaurant_id: string }
        Returns: {
          created_at: string
          id: string
          permissions: Json
          restaurant_id: string
          role: string
          user_email: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_subscription_tokens: {
        Args: { p_restaurant_id: string; p_tokens: number }
        Returns: undefined
      }
      upsert_debounce_message: {
        Args: {
          p_customer_phone: string
          p_debounce_seconds?: number
          p_instance_name: string
          p_message_body: string
          p_restaurant_id: string
        }
        Returns: {
          action: string
          id: string
          message_count: number
        }[]
      }
      user_has_restaurant_access: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
