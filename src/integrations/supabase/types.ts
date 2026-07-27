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
      brands: {
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
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
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
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          category_id: string | null
          cost: number
          created_at: string
          expiry_date: string | null
          id: string
          is_active: boolean
          low_stock_at: number
          name_bn: string
          name_en: string
          price: number
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
          is_active?: boolean
          low_stock_at?: number
          name_bn: string
          name_en: string
          price?: number
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
          is_active?: boolean
          low_stock_at?: number
          name_bn?: string
          name_en?: string
          price?: number
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
          created_at: string
          full_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          username?: string | null
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
          created_at: string
          id: string
          purchase_id: string | null
          reason: string | null
          supplier_id: string | null
          total: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          purchase_id?: string | null
          reason?: string | null
          supplier_id?: string | null
          total?: number
          user_id?: string | null
        }
        Update: {
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
          created_at: string
          id: string
          reason: string | null
          sale_id: string | null
          total: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          sale_id?: string | null
          total?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          sale_id?: string | null
          total?: number
          user_id?: string | null
        }
        Relationships: [
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
            foreignKeyName: "sales_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjusted_on: string
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
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
