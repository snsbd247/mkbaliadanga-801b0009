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
          entity: string | null
          entity_id: string | null
          id: string
          ip_address: string | null
          meta: Json | null
          new_values: Json | null
          office_id: string | null
          old_values: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          meta?: Json | null
          new_values?: Json | null
          office_id?: string | null
          old_values?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          meta?: Json | null
          new_values?: Json | null
          office_id?: string | null
          old_values?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          company_name: string
          company_name_bn: string | null
          default_loan_interest: number
          email: string | null
          id: number
          logo_url: string | null
          mobile: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name?: string
          company_name_bn?: string | null
          default_loan_interest?: number
          email?: string | null
          id?: number
          logo_url?: string | null
          mobile?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string
          company_name_bn?: string | null
          default_loan_interest?: number
          email?: string | null
          id?: number
          logo_url?: string | null
          mobile?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      farmers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          district: string | null
          division: string | null
          farmer_code: string
          father_name: string | null
          id: string
          mobile: string | null
          mother_name: string | null
          name_bn: string | null
          name_en: string
          nid: string | null
          office_id: string | null
          photo_url: string | null
          post_office: string | null
          status: string
          upazila: string | null
          updated_at: string
          village: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          division?: string | null
          farmer_code: string
          father_name?: string | null
          id?: string
          mobile?: string | null
          mother_name?: string | null
          name_bn?: string | null
          name_en: string
          nid?: string | null
          office_id?: string | null
          photo_url?: string | null
          post_office?: string | null
          status?: string
          upazila?: string | null
          updated_at?: string
          village?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          division?: string | null
          farmer_code?: string
          father_name?: string | null
          id?: string
          mobile?: string | null
          mother_name?: string | null
          name_bn?: string | null
          name_en?: string
          nid?: string | null
          office_id?: string | null
          photo_url?: string | null
          post_office?: string | null
          status?: string
          upazila?: string | null
          updated_at?: string
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmers_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigation_charges: {
        Row: {
          base_charge: number
          basis: Database["public"]["Enums"]["irrigation_basis"]
          canal_charge: number
          created_at: string
          created_by: string | null
          due_amount: number
          entry_date: string
          farmer_id: string
          id: string
          land_id: string
          maintenance_charge: number
          note: string | null
          office_id: string | null
          other_charge: number
          paid_amount: number
          quantity: number
          season_id: string
          total: number
        }
        Insert: {
          base_charge?: number
          basis?: Database["public"]["Enums"]["irrigation_basis"]
          canal_charge?: number
          created_at?: string
          created_by?: string | null
          due_amount?: number
          entry_date?: string
          farmer_id: string
          id?: string
          land_id: string
          maintenance_charge?: number
          note?: string | null
          office_id?: string | null
          other_charge?: number
          paid_amount?: number
          quantity?: number
          season_id: string
          total?: number
        }
        Update: {
          base_charge?: number
          basis?: Database["public"]["Enums"]["irrigation_basis"]
          canal_charge?: number
          created_at?: string
          created_by?: string | null
          due_amount?: number
          entry_date?: string
          farmer_id?: string
          id?: string
          land_id?: string
          maintenance_charge?: number
          note?: string | null
          office_id?: string | null
          other_charge?: number
          paid_amount?: number
          quantity?: number
          season_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_charges_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_charges_land_id_fkey"
            columns: ["land_id"]
            isOneToOne: false
            referencedRelation: "lands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_charges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      lands: {
        Row: {
          created_at: string
          dag_no: string | null
          farmer_id: string
          field_type: Database["public"]["Enums"]["field_type"]
          id: string
          land_size: number
          mouza: string | null
          office_id: string | null
          owner_type: Database["public"]["Enums"]["owner_type"]
        }
        Insert: {
          created_at?: string
          dag_no?: string | null
          farmer_id: string
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          land_size?: number
          mouza?: string | null
          office_id?: string | null
          owner_type?: Database["public"]["Enums"]["owner_type"]
        }
        Update: {
          created_at?: string
          dag_no?: string | null
          farmer_id?: string
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          land_size?: number
          mouza?: string | null
          office_id?: string | null
          owner_type?: Database["public"]["Enums"]["owner_type"]
        }
        Relationships: [
          {
            foreignKeyName: "lands_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payments: {
        Row: {
          amount: number
          collected_by: string | null
          created_at: string
          id: string
          loan_id: string
          office_id: string | null
          paid_on: string
        }
        Insert: {
          amount: number
          collected_by?: string | null
          created_at?: string
          id?: string
          loan_id: string
          office_id?: string | null
          paid_on?: string
        }
        Update: {
          amount?: number
          collected_by?: string | null
          created_at?: string
          id?: string
          loan_id?: string
          office_id?: string | null
          paid_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          farmer_id: string
          id: string
          interest_enabled: boolean
          interest_rate: number
          issued_on: string
          next_due_on: string | null
          note: string | null
          office_id: string | null
          principal: number
          status: Database["public"]["Enums"]["loan_status"]
          total_payable: number
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          farmer_id: string
          id?: string
          interest_enabled?: boolean
          interest_rate?: number
          issued_on?: string
          next_due_on?: string | null
          note?: string | null
          office_id?: string | null
          principal: number
          status?: Database["public"]["Enums"]["loan_status"]
          total_payable?: number
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          farmer_id?: string
          id?: string
          interest_enabled?: boolean
          interest_rate?: number
          issued_on?: string
          next_due_on?: string | null
          note?: string | null
          office_id?: string | null
          principal?: number
          status?: Database["public"]["Enums"]["loan_status"]
          total_payable?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      offices: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          established_on: string | null
          id: string
          name: string
          registration_no: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          established_on?: string | null
          id?: string
          name: string
          registration_no?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          established_on?: string | null
          id?: string
          name?: string
          registration_no?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          collected_by: string | null
          created_at: string
          farmer_id: string
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method: string | null
          note: string | null
          office_id: string | null
          receipt_url: string | null
          reference_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          collected_by?: string | null
          created_at?: string
          farmer_id: string
          id?: string
          kind: Database["public"]["Enums"]["payment_kind"]
          method?: string | null
          note?: string | null
          office_id?: string | null
          receipt_url?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          collected_by?: string | null
          created_at?: string
          farmer_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          method?: string | null
          note?: string | null
          office_id?: string | null
          receipt_url?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          language_pref: string
          office_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          language_pref?: string
          office_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          language_pref?: string
          office_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_transactions: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string
          created_by: string | null
          farmer_id: string
          id: string
          note: string | null
          office_id: string | null
          status: Database["public"]["Enums"]["approval_status"]
          txn_date: string
          type: Database["public"]["Enums"]["savings_txn_type"]
        }
        Insert: {
          amount: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          farmer_id: string
          id?: string
          note?: string | null
          office_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          txn_date?: string
          type: Database["public"]["Enums"]["savings_txn_type"]
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          farmer_id?: string
          id?: string
          note?: string | null
          office_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          txn_date?: string
          type?: Database["public"]["Enums"]["savings_txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "savings_transactions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          id: string
          name: string | null
          type: Database["public"]["Enums"]["season_type"]
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          type: Database["public"]["Enums"]["season_type"]
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          type?: Database["public"]["Enums"]["season_type"]
          year?: number
        }
        Relationships: []
      }
      shares: {
        Row: {
          balance: number
          farmer_id: string
          id: string
          office_id: string | null
          updated_at: string
        }
        Insert: {
          balance?: number
          farmer_id: string
          id?: string
          office_id?: string | null
          updated_at?: string
        }
        Update: {
          balance?: number
          farmer_id?: string
          id?: string
          office_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_add: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          id: string
          module: string
          user_id: string
        }
        Insert: {
          can_add?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module: string
          user_id: string
        }
        Update: {
          can_add?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module?: string
          user_id?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      _lookup_email_by_username: {
        Args: { _username: string }
        Returns: string
      }
      current_user_office: { Args: never; Returns: string }
      email_for_username: { Args: { _username: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "staff"
      approval_status: "pending" | "approved" | "rejected"
      field_type: "high_land" | "medium_land" | "low_land" | "other"
      irrigation_basis: "per_size" | "per_day" | "per_hour"
      loan_status: "pending" | "approved" | "paid" | "rejected"
      owner_type: "owner" | "borgadar"
      payment_kind: "loan" | "savings" | "irrigation"
      payment_status: "pending" | "approved" | "rejected"
      savings_txn_type: "deposit" | "withdraw"
      season_type: "aman" | "boro" | "iri" | "other"
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
      app_role: ["super_admin", "admin", "staff"],
      approval_status: ["pending", "approved", "rejected"],
      field_type: ["high_land", "medium_land", "low_land", "other"],
      irrigation_basis: ["per_size", "per_day", "per_hour"],
      loan_status: ["pending", "approved", "paid", "rejected"],
      owner_type: ["owner", "borgadar"],
      payment_kind: ["loan", "savings", "irrigation"],
      payment_status: ["pending", "approved", "rejected"],
      savings_txn_type: ["deposit", "withdraw"],
      season_type: ["aman", "boro", "iri", "other"],
    },
  },
} as const
