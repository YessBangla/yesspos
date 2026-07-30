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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_transactions: {
        Row: {
          account_id: string | null
          amount: number
          branch_id: string | null
          created_at: string
          id: string
          note: string | null
          to_account_id: string | null
          txn_date: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number
          branch_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          to_account_id?: string | null
          txn_date?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          branch_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          to_account_id?: string | null
          txn_date?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_number: string | null
          bank_name: string | null
          branch: string | null
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          note: string | null
          opening_balance: number
          type: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          branch?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          opening_balance?: number
          type?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          branch?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          opening_balance?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      api_settings: {
        Row: {
          api_key: string | null
          api_secret: string | null
          base_url: string | null
          category: string
          created_at: string
          enabled: boolean
          extra: Json
          id: string
          label: string
          notes: string | null
          provider: string
          sender_id: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          base_url?: string | null
          category?: string
          created_at?: string
          enabled?: boolean
          extra?: Json
          id?: string
          label: string
          notes?: string | null
          provider: string
          sender_id?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          base_url?: string | null
          category?: string
          created_at?: string
          enabled?: boolean
          extra?: Json
          id?: string
          label?: string
          notes?: string | null
          provider?: string
          sender_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          entity: string | null
          entity_id: string | null
          id: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name_bn: string
          name_en: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name_bn: string
          name_en: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name_bn?: string
          name_en?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          address: string | null
          currency_symbol: string
          default_tax_pct: number
          id: string
          phone: string | null
          receipt_footer: string | null
          shop_name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          currency_symbol?: string
          default_tax_pct?: number
          id?: string
          phone?: string | null
          receipt_footer?: string | null
          shop_name?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          currency_symbol?: string
          default_tax_pct?: number
          id?: string
          phone?: string | null
          receipt_footer?: string | null
          shop_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name_bn: string
          name_en: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_bn: string
          name_en: string
        }
        Update: {
          created_at?: string
          id?: string
          name_bn?: string
          name_en?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_member: boolean
          loyalty_points: number
          member_since: string | null
          name: string
          opening_balance: number
          phone: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_member?: boolean
          loyalty_points?: number
          member_since?: string | null
          name: string
          opening_balance?: number
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_member?: boolean
          loyalty_points?: number
          member_since?: string | null
          name?: string
          opening_balance?: number
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          expires_on: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          min_amount: number
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_on?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_amount?: number
          type?: string
          updated_at?: string
          value?: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_on?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_amount?: number
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address: string
          area: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          label: string
          note: string | null
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          area: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          label?: string
          note?: string | null
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          area?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string
          note?: string | null
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_notifications: {
        Row: {
          body: string
          channel: string
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          event_type: string
          from_value: string | null
          id: string
          is_read: boolean
          is_sent: boolean
          last_attempt_at: string | null
          last_error: string | null
          order_id: string | null
          order_no: number | null
          send_attempts: number
          send_status: string
          sent_at: string | null
          title: string
          to_value: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          event_type?: string
          from_value?: string | null
          id?: string
          is_read?: boolean
          is_sent?: boolean
          last_attempt_at?: string | null
          last_error?: string | null
          order_id?: string | null
          order_no?: number | null
          send_attempts?: number
          send_status?: string
          sent_at?: string | null
          title: string
          to_value?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          event_type?: string
          from_value?: string | null
          id?: string
          is_read?: boolean
          is_sent?: boolean
          last_attempt_at?: string | null
          last_error?: string | null
          order_id?: string | null
          order_no?: number | null
          send_attempts?: number
          send_status?: string
          sent_at?: string | null
          title?: string
          to_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_feedback: {
        Row: {
          created_at: string
          customer_phone: string | null
          id: string
          kind: string
          message: string | null
          order_id: string | null
          order_no: number | null
          rating: number | null
          resolved: boolean
          resolved_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_phone?: string | null
          id?: string
          kind?: string
          message?: string | null
          order_id?: string | null
          order_no?: number | null
          rating?: number | null
          resolved?: boolean
          resolved_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_phone?: string | null
          id?: string
          kind?: string
          message?: string | null
          order_id?: string | null
          order_no?: number | null
          rating?: number | null
          resolved?: boolean
          resolved_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_order_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          event_type: string
          from_value: string | null
          id: string
          note: string | null
          order_id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          event_type?: string
          from_value?: string | null
          id?: string
          note?: string | null
          order_id: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          event_type?: string
          from_value?: string | null
          id?: string
          note?: string | null
          order_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          name_snapshot: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          name_snapshot: string
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          name_snapshot?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          address: string
          area: string | null
          assigned_to: string | null
          branch_id: string | null
          contact_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_fee: number
          discount: number
          id: string
          note: string | null
          order_no: number
          payment_method: string
          rider_id: string | null
          sale_id: string | null
          scheduled_at: string | null
          slot: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
          zone_id: string | null
        }
        Insert: {
          address: string
          area?: string | null
          assigned_to?: string | null
          branch_id?: string | null
          contact_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          delivery_fee?: number
          discount?: number
          id?: string
          note?: string | null
          order_no?: number
          payment_method?: string
          rider_id?: string | null
          sale_id?: string | null
          scheduled_at?: string | null
          slot?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          zone_id?: string | null
        }
        Update: {
          address?: string
          area?: string | null
          assigned_to?: string | null
          branch_id?: string | null
          contact_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number
          discount?: number
          id?: string
          note?: string | null
          order_no?: number
          payment_method?: string
          rider_id?: string | null
          sale_id?: string | null
          scheduled_at?: string | null
          slot?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "delivery_riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_proofs: {
        Row: {
          created_at: string
          created_by: string | null
          file_path: string
          id: string
          kind: string
          lat: number | null
          lng: number | null
          note: string | null
          order_id: string
          receiver_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_path: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          order_id: string
          receiver_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_path?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          order_id?: string
          receiver_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_riders: {
        Row: {
          branch_id: string | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          id: string
          is_active: boolean
          location_updated_at: string | null
          name: string
          nid: string | null
          note: string | null
          phone: string
          updated_at: string
          user_id: string | null
          vehicle: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          is_active?: boolean
          location_updated_at?: string | null
          name: string
          nid?: string | null
          note?: string | null
          phone: string
          updated_at?: string
          user_id?: string | null
          vehicle?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          is_active?: boolean
          location_updated_at?: string | null
          name?: string
          nid?: string | null
          note?: string | null
          phone?: string
          updated_at?: string
          user_id?: string | null
          vehicle?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_riders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          branch_id: string | null
          created_at: string
          delivery_fee: number
          eta_minutes: number
          free_delivery_above: number | null
          id: string
          is_active: boolean
          min_order: number
          name_bn: string
          name_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          delivery_fee?: number
          eta_minutes?: number
          free_delivery_above?: number | null
          id?: string
          is_active?: boolean
          min_order?: number
          name_bn: string
          name_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          delivery_fee?: number
          eta_minutes?: number
          free_delivery_above?: number | null
          id?: string
          is_active?: boolean
          min_order?: number
          name_bn?: string
          name_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name_bn: string
          name_en: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_bn: string
          name_en: string
        }
        Update: {
          created_at?: string
          id?: string
          name_bn?: string
          name_en?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string | null
          category_id: string | null
          created_at: string
          id: string
          note: string | null
          payment_method: string
          spent_on: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          payment_method?: string
          spent_on?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          payment_method?: string
          spent_on?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          branch_id: string | null
          created_at: string
          entry_date: string
          id: string
          narration: string | null
          reference: string | null
          updated_at: string
          user_id: string | null
          voucher_no: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          narration?: string | null
          reference?: string | null
          updated_at?: string
          user_id?: string | null
          voucher_no?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          narration?: string | null
          reference?: string | null
          updated_at?: string
          user_id?: string | null
          voucher_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string | null
          created_at: string
          credit: number
          debit: number
          entry_id: string
          id: string
          ledger_account_id: string | null
          note: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          ledger_account_id?: string | null
          note?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          ledger_account_id?: string | null
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          class: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_bn: string
          name_en: string
          updated_at: string
        }
        Insert: {
          class?: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_bn: string
          name_en: string
          updated_at?: string
        }
        Update: {
          class?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_bn?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_ledger: {
        Row: {
          amount: number
          branch_id: string | null
          contact_id: string
          created_at: string
          id: string
          note: string | null
          points: number
          sale_id: string | null
          type: string
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          contact_id: string
          created_at?: string
          id?: string
          note?: string | null
          points: number
          sale_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          note?: string | null
          points?: number
          sale_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_ledger_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_ledger_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_ledger_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          branch_id: string | null
          contact_id: string | null
          created_at: string
          direction: string
          id: string
          method: string
          note: string | null
          paid_on: string
          purchase_id: string | null
          sale_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          contact_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          method?: string
          note?: string | null
          paid_on?: string
          purchase_id?: string | null
          sale_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          contact_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          method?: string
          note?: string | null
          paid_on?: string
          purchase_id?: string | null
          sale_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_name: string
          id: string
          is_approved: boolean
          product_id: string
          rating: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_name: string
          id?: string
          is_approved?: boolean
          product_id: string
          rating?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          is_approved?: boolean
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          product_id: string
          stock: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          product_id: string
          stock?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          product_id?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          category_id: string | null
          cost: number
          created_at: string
          expiry_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          low_stock_at: number
          name_bn: string
          name_en: string
          pack_size: string | null
          price: number
          seq: number | null
          sku: string
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_at?: number
          name_bn: string
          name_en: string
          pack_size?: string | null
          price?: number
          seq?: number | null
          sku: string
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          cost?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_at?: number
          name_bn?: string
          name_en?: string
          pack_size?: string | null
          price?: number
          seq?: number | null
          sku?: string
          stock?: number
          unit?: string
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
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          full_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          bg_color: string | null
          created_at: string
          ends_on: string | null
          id: string
          image_url: string | null
          is_active: boolean
          kind: string
          link_url: string | null
          placement: string
          sort_order: number
          starts_on: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          link_url?: string | null
          placement?: string
          sort_order?: number
          starts_on?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          link_url?: string | null
          placement?: string
          sort_order?: number
          starts_on?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          id: string
          line_total: number
          name_snapshot: string
          product_id: string | null
          purchase_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          id?: string
          line_total?: number
          name_snapshot: string
          product_id?: string | null
          purchase_id: string
          quantity?: number
          unit_cost?: number
        }
        Update: {
          id?: string
          line_total?: number
          name_snapshot?: string
          product_id?: string | null
          purchase_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          name_snapshot: string
          order_id: string
          product_id: string | null
          quantity: number
          received_qty: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          name_snapshot: string
          order_id: string
          product_id?: string | null
          quantity?: number
          received_qty?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          name_snapshot?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          received_qty?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string | null
          created_at: string
          expected_date: string | null
          id: string
          note: string | null
          order_date: string
          po_no: number
          status: string
          supplier_id: string | null
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          expected_date?: string | null
          id?: string
          note?: string | null
          order_date?: string
          po_no?: number
          status?: string
          supplier_id?: string | null
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          expected_date?: string | null
          id?: string
          note?: string | null
          order_date?: string
          po_no?: number
          status?: string
          supplier_id?: string | null
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_return_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          name_snapshot: string
          product_id: string | null
          quantity: number
          return_id: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          name_snapshot: string
          product_id?: string | null
          quantity?: number
          return_id: string
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          name_snapshot?: string
          product_id?: string | null
          quantity?: number
          return_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          purchase_id: string | null
          reason: string | null
          supplier_id: string | null
          total: number
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          purchase_id?: string | null
          reason?: string | null
          supplier_id?: string | null
          total?: number
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          purchase_id?: string | null
          reason?: string | null
          supplier_id?: string | null
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          note: string | null
          paid: number
          purchased_on: string
          ref_no: number
          supplier_id: string | null
          total: number
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          paid?: number
          purchased_on?: string
          ref_no?: number
          supplier_id?: string | null
          total?: number
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          paid?: number
          purchased_on?: string
          ref_no?: number
          supplier_id?: string | null
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          line_total: number
          name_snapshot: string
          product_id: string | null
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          line_total?: number
          name_snapshot: string
          product_id?: string | null
          quantity?: number
          sale_id: string
          unit_price?: number
        }
        Update: {
          id?: string
          line_total?: number
          name_snapshot?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_return_items: {
        Row: {
          id: string
          line_total: number
          name_snapshot: string
          product_id: string | null
          quantity: number
          return_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          line_total?: number
          name_snapshot: string
          product_id?: string | null
          quantity?: number
          return_id: string
          unit_price?: number
        }
        Update: {
          id?: string
          line_total?: number
          name_snapshot?: string
          product_id?: string | null
          quantity?: number
          return_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_returns: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          reason: string | null
          sale_id: string | null
          total: number
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          sale_id?: string | null
          total?: number
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          sale_id?: string | null
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string | null
          cashier_id: string | null
          contact_id: string | null
          coupon_code: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          discount: number
          id: string
          invoice_no: number
          note: string | null
          paid: number
          payment_method: string
          status: string
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          branch_id?: string | null
          cashier_id?: string | null
          contact_id?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          id?: string
          invoice_no?: number
          note?: string | null
          paid?: number
          payment_method?: string
          status?: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Update: {
          branch_id?: string | null
          cashier_id?: string | null
          contact_id?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          id?: string
          invoice_no?: number
          note?: string | null
          paid?: number
          payment_method?: string
          status?: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          created_at: string
          group_name: string
          id: string
          key: string
          kind: string
          label: string
          sort_order: number
          updated_at: string
          value_bn: string
          value_en: string
        }
        Insert: {
          created_at?: string
          group_name?: string
          id?: string
          key: string
          kind?: string
          label: string
          sort_order?: number
          updated_at?: string
          value_bn?: string
          value_en?: string
        }
        Update: {
          created_at?: string
          group_name?: string
          id?: string
          key?: string
          kind?: string
          label?: string
          sort_order?: number
          updated_at?: string
          value_bn?: string
          value_en?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          adjusted_on: string
          branch_id: string | null
          created_at: string
          id: string
          product_id: string | null
          quantity: number
          reason: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          adjusted_on?: string
          branch_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          quantity?: number
          reason?: string | null
          type?: string
          user_id?: string | null
        }
        Update: {
          adjusted_on?: string
          branch_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          quantity?: number
          reason?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_items: {
        Row: {
          count_id: string
          counted_qty: number
          created_at: string
          id: string
          name_snapshot: string
          product_id: string | null
          system_qty: number
        }
        Insert: {
          count_id: string
          counted_qty?: number
          created_at?: string
          id?: string
          name_snapshot: string
          product_id?: string | null
          system_qty?: number
        }
        Update: {
          count_id?: string
          counted_qty?: number
          created_at?: string
          id?: string
          name_snapshot?: string
          product_id?: string | null
          system_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          branch_id: string | null
          count_date: string
          created_at: string
          id: string
          note: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          count_date?: string
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          count_date?: string
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          created_at: string
          id: string
          name_snapshot: string
          product_id: string | null
          quantity: number
          transfer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_snapshot: string
          product_id?: string | null
          quantity?: number
          transfer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name_snapshot?: string
          product_id?: string | null
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          from_branch_id: string
          id: string
          note: string | null
          to_branch_id: string
          transfer_date: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          from_branch_id: string
          id?: string
          note?: string | null
          to_branch_id: string
          transfer_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          from_branch_id?: string
          id?: string
          note?: string | null
          to_branch_id?: string
          transfer_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          id: string
          name_bn: string
          name_en: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_bn: string
          name_en: string
        }
        Update: {
          created_at?: string
          id?: string
          name_bn?: string
          name_en?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_branch_stock: {
        Args: { _branch_id: string; _delta: number; _product_id: string }
        Returns: undefined
      }
      apply_loyalty: {
        Args: {
          _amount: number
          _branch_id?: string
          _contact_id: string
          _redeem_points?: number
          _sale_id: string
        }
        Returns: number
      }
      can_see_branch: { Args: { _branch_id: string }; Returns: boolean }
      check_order_consistency: {
        Args: { _lines: Json }
        Returns: {
          detail: string
          issue: string
          name: string
          product_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      my_branch_id: { Args: never; Returns: string }
      register_member: {
        Args: { _name?: string; _phone: string }
        Returns: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_member: boolean
          loyalty_points: number
          member_since: string | null
          name: string
          opening_balance: number
          phone: string | null
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contacts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_delivery_feedback: {
        Args: {
          _kind: string
          _message?: string
          _order_no: number
          _phone: string
          _rating?: number
        }
        Returns: string
      }
      track_delivery_order: {
        Args: { _order_no: number; _phone: string }
        Returns: {
          area: string
          created_at: string
          eta_minutes: number
          order_no: number
          payment_method: string
          rider_lat: number
          rider_lng: number
          rider_location_at: string
          rider_name: string
          rider_phone: string
          rider_vehicle: string
          slot: string
          status: string
          total: number
          updated_at: string
        }[]
      }
      track_delivery_proofs: {
        Args: { _order_no: number; _phone: string }
        Returns: {
          created_at: string
          file_path: string
          kind: string
          note: string
          receiver_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "cashier" | "super_admin" | "manager" | "staff"
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
      app_role: ["admin", "cashier", "super_admin", "manager", "staff"],
    },
  },
} as const
