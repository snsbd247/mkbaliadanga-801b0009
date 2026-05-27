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
      accounting_periods: {
        Row: {
          cash_in: number
          cash_out: number
          closed_at: string | null
          closed_by: string | null
          closing_balance_snapshot: Json | null
          created_at: string
          id: string
          net_income: number
          note: string | null
          office_id: string | null
          period_end: string
          period_start: string
          status: string
          total_credit: number
          total_debit: number
          total_expense: number
          total_income: number
          updated_at: string
        }
        Insert: {
          cash_in?: number
          cash_out?: number
          closed_at?: string | null
          closed_by?: string | null
          closing_balance_snapshot?: Json | null
          created_at?: string
          id?: string
          net_income?: number
          note?: string | null
          office_id?: string | null
          period_end: string
          period_start: string
          status?: string
          total_credit?: number
          total_debit?: number
          total_expense?: number
          total_income?: number
          updated_at?: string
        }
        Update: {
          cash_in?: number
          cash_out?: number
          closed_at?: string | null
          closed_by?: string | null
          closing_balance_snapshot?: Json | null
          created_at?: string
          id?: string
          net_income?: number
          note?: string | null
          office_id?: string | null
          period_end?: string
          period_start?: string
          status?: string
          total_credit?: number
          total_debit?: number
          total_expense?: number
          total_income?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          name_bn: string | null
          parent_id: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          name_bn?: string | null
          parent_id?: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          name_bn?: string | null
          parent_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          asset_id: string
          created_at: string
          details: Json | null
          id: string
          last_sms_at: string | null
          location_id: string | null
          message_bn: string | null
          message_en: string
          office_id: string | null
          resolved_at: string | null
          severity: string
          sms_sent_count: number
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          asset_id: string
          created_at?: string
          details?: Json | null
          id?: string
          last_sms_at?: string | null
          location_id?: string | null
          message_bn?: string | null
          message_en: string
          office_id?: string | null
          resolved_at?: string | null
          severity?: string
          sms_sent_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          asset_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          last_sms_at?: string | null
          location_id?: string | null
          message_bn?: string | null
          message_en?: string
          office_id?: string | null
          resolved_at?: string | null
          severity?: string
          sms_sent_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_alerts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_audit_logs: {
        Row: {
          action_type: string
          asset_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          new_data: Json | null
          office_id: string | null
          old_data: Json | null
          remarks: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          asset_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          office_id?: string | null
          old_data?: Json | null
          remarks?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          asset_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          new_data?: Json | null
          office_id?: string | null
          old_data?: Json | null
          remarks?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      asset_categories: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name_bn: string | null
          name_en: string
          office_id: string | null
          tracking_mode: Database["public"]["Enums"]["asset_tracking_mode"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name_bn?: string | null
          name_en: string
          office_id?: string | null
          tracking_mode?: Database["public"]["Enums"]["asset_tracking_mode"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name_bn?: string | null
          name_en?: string
          office_id?: string | null
          tracking_mode?: Database["public"]["Enums"]["asset_tracking_mode"]
          updated_at?: string
        }
        Relationships: []
      }
      asset_damage_reports: {
        Row: {
          asset_id: string
          created_at: string
          deleted_at: string | null
          id: string
          office_id: string | null
          remarks: string | null
          report_date: string
          reported_by: string | null
          severity: string | null
          status: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          office_id?: string | null
          remarks?: string | null
          report_date?: string
          reported_by?: string | null
          severity?: string | null
          status?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          office_id?: string | null
          remarks?: string | null
          report_date?: string
          reported_by?: string | null
          severity?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_damage_reports_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_depreciation_schedule: {
        Row: {
          accumulated_depreciation: number
          asset_id: string
          closing_book_value: number
          created_at: string
          depreciation_amount: number
          id: string
          journal_entry_id: string | null
          office_id: string | null
          opening_book_value: number
          period_month: string
          posted_at: string | null
          posted_by: string | null
          status: Database["public"]["Enums"]["asset_depreciation_status"]
        }
        Insert: {
          accumulated_depreciation?: number
          asset_id: string
          closing_book_value?: number
          created_at?: string
          depreciation_amount?: number
          id?: string
          journal_entry_id?: string | null
          office_id?: string | null
          opening_book_value?: number
          period_month: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["asset_depreciation_status"]
        }
        Update: {
          accumulated_depreciation?: number
          asset_id?: string
          closing_book_value?: number
          created_at?: string
          depreciation_amount?: number
          id?: string
          journal_entry_id?: string | null
          office_id?: string | null
          opening_book_value?: number
          period_month?: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["asset_depreciation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "asset_depreciation_schedule_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_depreciation_settings: {
        Row: {
          accum_account_code: string
          asset_id: string
          created_at: string
          created_by: string | null
          expense_account_code: string
          id: string
          is_active: boolean
          method: Database["public"]["Enums"]["asset_depreciation_method"]
          office_id: string | null
          salvage_value: number
          start_on: string
          updated_at: string
          useful_life_months: number
          wdv_rate_pct: number
        }
        Insert: {
          accum_account_code?: string
          asset_id: string
          created_at?: string
          created_by?: string | null
          expense_account_code?: string
          id?: string
          is_active?: boolean
          method?: Database["public"]["Enums"]["asset_depreciation_method"]
          office_id?: string | null
          salvage_value?: number
          start_on?: string
          updated_at?: string
          useful_life_months?: number
          wdv_rate_pct?: number
        }
        Update: {
          accum_account_code?: string
          asset_id?: string
          created_at?: string
          created_by?: string | null
          expense_account_code?: string
          id?: string
          is_active?: boolean
          method?: Database["public"]["Enums"]["asset_depreciation_method"]
          office_id?: string | null
          salvage_value?: number
          start_on?: string
          updated_at?: string
          useful_life_months?: number
          wdv_rate_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_depreciation_settings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_disposals: {
        Row: {
          asset_id: string
          book_value: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          disposal_date: string
          gain_loss: number
          id: string
          journal_entry_id: string | null
          method: Database["public"]["Enums"]["asset_disposal_method"]
          office_id: string | null
          remarks: string | null
          sale_amount: number
        }
        Insert: {
          asset_id: string
          book_value?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disposal_date?: string
          gain_loss?: number
          id?: string
          journal_entry_id?: string | null
          method?: Database["public"]["Enums"]["asset_disposal_method"]
          office_id?: string | null
          remarks?: string | null
          sale_amount?: number
        }
        Update: {
          asset_id?: string
          book_value?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disposal_date?: string
          gain_loss?: number
          id?: string
          journal_entry_id?: string | null
          method?: Database["public"]["Enums"]["asset_disposal_method"]
          office_id?: string | null
          remarks?: string | null
          sale_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_disposals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_installations: {
        Row: {
          asset_id: string
          condition_status: string | null
          created_at: string
          deleted_at: string | null
          id: string
          install_date: string
          installed_by: string | null
          location_id: string | null
          location_name: string | null
          office_id: string | null
          remarks: string | null
        }
        Insert: {
          asset_id: string
          condition_status?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          install_date?: string
          installed_by?: string | null
          location_id?: string | null
          location_name?: string | null
          office_id?: string | null
          remarks?: string | null
        }
        Update: {
          asset_id?: string
          condition_status?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          install_date?: string
          installed_by?: string | null
          location_id?: string | null
          location_name?: string | null
          office_id?: string | null
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_installations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance_logs: {
        Row: {
          asset_id: string
          cost: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          downtime_days: number
          id: string
          maintenance_date: string
          office_id: string | null
          remarks: string | null
          status: string | null
          vendor: string | null
        }
        Insert: {
          asset_id: string
          cost?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          downtime_days?: number
          id?: string
          maintenance_date?: string
          office_id?: string | null
          remarks?: string | null
          status?: string | null
          vendor?: string | null
        }
        Update: {
          asset_id?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          downtime_days?: number
          id?: string
          maintenance_date?: string
          office_id?: string | null
          remarks?: string | null
          status?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance_schedules: {
        Row: {
          active: boolean
          asset_id: string
          created_at: string
          created_by: string | null
          frequency_days: number
          id: string
          last_generated_alert_at: string | null
          next_due_at: string
          notes: string | null
          office_id: string | null
          title: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          active?: boolean
          asset_id: string
          created_at?: string
          created_by?: string | null
          frequency_days: number
          id?: string
          last_generated_alert_at?: string | null
          next_due_at: string
          notes?: string | null
          office_id?: string | null
          title: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          active?: boolean
          asset_id?: string
          created_at?: string
          created_by?: string | null
          frequency_days?: number
          id?: string
          last_generated_alert_at?: string | null
          next_due_at?: string
          notes?: string | null
          office_id?: string | null
          title?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_schedules_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_movements: {
        Row: {
          applied: boolean
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          asset_id: string
          created_at: string
          deleted_at: string | null
          from_location_id: string | null
          id: string
          moved_by: string | null
          movement_date: string
          office_id: string | null
          quantity: number
          rejection_reason: string | null
          remarks: string | null
          requested_by: string | null
          to_location_id: string | null
        }
        Insert: {
          applied?: boolean
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          asset_id: string
          created_at?: string
          deleted_at?: string | null
          from_location_id?: string | null
          id?: string
          moved_by?: string | null
          movement_date?: string
          office_id?: string | null
          quantity?: number
          rejection_reason?: string | null
          remarks?: string | null
          requested_by?: string | null
          to_location_id?: string | null
        }
        Update: {
          applied?: boolean
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          asset_id?: string
          created_at?: string
          deleted_at?: string | null
          from_location_id?: string | null
          id?: string
          moved_by?: string | null
          movement_date?: string
          office_id?: string | null
          quantity?: number
          rejection_reason?: string | null
          remarks?: string | null
          requested_by?: string | null
          to_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_movements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_purchases: {
        Row: {
          asset_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          invoice_no: string | null
          journal_entry_id: string | null
          notes: string | null
          office_id: string | null
          payment_method: string | null
          purchase_date: string
          quantity: number
          supplier: string | null
          total_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invoice_no?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          office_id?: string | null
          payment_method?: string | null
          purchase_date?: string
          quantity?: number
          supplier?: string | null
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invoice_no?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          office_id?: string | null
          payment_method?: string | null
          purchase_date?: string
          quantity?: number
          supplier?: string | null
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_purchases_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_scan_logs: {
        Row: {
          asset_code: string | null
          asset_id: string | null
          error_message: string | null
          id: string
          office_id: string | null
          scanned_at: string
          scanned_by: string | null
          scanned_text: string
          source: string
          success: boolean
        }
        Insert: {
          asset_code?: string | null
          asset_id?: string | null
          error_message?: string | null
          id?: string
          office_id?: string | null
          scanned_at?: string
          scanned_by?: string | null
          scanned_text: string
          source?: string
          success?: boolean
        }
        Update: {
          asset_code?: string | null
          asset_id?: string | null
          error_message?: string | null
          id?: string
          office_id?: string | null
          scanned_at?: string
          scanned_by?: string | null
          scanned_text?: string
          source?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "asset_scan_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_stocks: {
        Row: {
          asset_id: string
          id: string
          location_id: string | null
          office_id: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          asset_id: string
          id?: string
          location_id?: string | null
          office_id?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          asset_id?: string
          id?: string
          location_id?: string | null
          office_id?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_stocks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_category_id: string | null
          asset_code: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          created_by: string | null
          current_location_id: string | null
          current_status: Database["public"]["Enums"]["asset_status"]
          deleted_at: string | null
          id: string
          installed_at: string | null
          lifecycle_status: string | null
          min_stock_level: number
          name_bn: string | null
          name_en: string
          notes: string | null
          office_id: string | null
          purchase_price: number
          serial_no: string | null
          tracking_mode: Database["public"]["Enums"]["asset_tracking_mode"]
          unit: string | null
          updated_at: string
          warranty_alert_days: number
          warranty_until: string | null
        }
        Insert: {
          asset_category_id?: string | null
          asset_code: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          created_by?: string | null
          current_location_id?: string | null
          current_status?: Database["public"]["Enums"]["asset_status"]
          deleted_at?: string | null
          id?: string
          installed_at?: string | null
          lifecycle_status?: string | null
          min_stock_level?: number
          name_bn?: string | null
          name_en: string
          notes?: string | null
          office_id?: string | null
          purchase_price?: number
          serial_no?: string | null
          tracking_mode?: Database["public"]["Enums"]["asset_tracking_mode"]
          unit?: string | null
          updated_at?: string
          warranty_alert_days?: number
          warranty_until?: string | null
        }
        Update: {
          asset_category_id?: string | null
          asset_code?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          created_by?: string | null
          current_location_id?: string | null
          current_status?: Database["public"]["Enums"]["asset_status"]
          deleted_at?: string | null
          id?: string
          installed_at?: string | null
          lifecycle_status?: string | null
          min_stock_level?: number
          name_bn?: string | null
          name_en?: string
          notes?: string | null
          office_id?: string | null
          purchase_price?: number
          serial_no?: string | null
          tracking_mode?: Database["public"]["Enums"]["asset_tracking_mode"]
          unit?: string | null
          updated_at?: string
          warranty_alert_days?: number
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_asset_category_id_fkey"
            columns: ["asset_category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
        ]
      }
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
      background_retry_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          job_type: string
          last_error: string | null
          max_retry: number
          next_retry_at: string
          office_id: string | null
          payload: Json
          reference_id: string | null
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_type: string
          last_error?: string | null
          max_retry?: number
          next_retry_at?: string
          office_id?: string | null
          payload?: Json
          reference_id?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          max_retry?: number
          next_retry_at?: string
          office_id?: string | null
          payload?: Json
          reference_id?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_no: string
          account_title: string | null
          account_type: string | null
          bank_name: string
          branch: string | null
          created_at: string
          id: string
          is_active: boolean
          office_id: string | null
          opening_balance: number
          updated_at: string
        }
        Insert: {
          account_no: string
          account_title?: string | null
          account_type?: string | null
          bank_name: string
          branch?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          office_id?: string | null
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          account_no?: string
          account_title?: string | null
          account_type?: string | null
          bank_name?: string
          branch?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          office_id?: string | null
          opening_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          counterparty_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          office_id: string | null
          reference_no: string | null
          transfer_group: string | null
          txn_date: string
          txn_type: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          counterparty_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          office_id?: string | null
          reference_no?: string | null
          transfer_group?: string | null
          txn_date?: string
          txn_type: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          counterparty_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          office_id?: string | null
          reference_no?: string | null
          transfer_group?: string | null
          txn_date?: string
          txn_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_counterparty_account_id_fkey"
            columns: ["counterparty_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      card_settings: {
        Row: {
          accent_color: string
          custom_text: string
          custom_text_bn: string
          font_scale: number
          header_height_mm: number
          header_text: string
          header_text_bn: string
          id: number
          logo_size_mm: number
          photo_size_mm: number
          show_account_number: boolean
          show_issue_date: boolean
          show_photo: boolean
          show_qr: boolean
          show_voter_number: boolean
          template_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_color?: string
          custom_text?: string
          custom_text_bn?: string
          font_scale?: number
          header_height_mm?: number
          header_text?: string
          header_text_bn?: string
          id?: number
          logo_size_mm?: number
          photo_size_mm?: number
          show_account_number?: boolean
          show_issue_date?: boolean
          show_photo?: boolean
          show_qr?: boolean
          show_voter_number?: boolean
          template_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_color?: string
          custom_text?: string
          custom_text_bn?: string
          font_scale?: number
          header_height_mm?: number
          header_text?: string
          header_text_bn?: string
          id?: number
          logo_size_mm?: number
          photo_size_mm?: number
          show_account_number?: boolean
          show_issue_date?: boolean
          show_photo?: boolean
          show_qr?: boolean
          show_voter_number?: boolean
          template_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cashbook_submissions: {
        Row: {
          closing_cash: number
          created_at: string
          id: string
          locked: boolean
          month: number
          note: string | null
          opening_cash: number
          submitted_at: string
          submitted_by: string | null
          total_expense: number
          total_income: number
          year: number
        }
        Insert: {
          closing_cash?: number
          created_at?: string
          id?: string
          locked?: boolean
          month: number
          note?: string | null
          opening_cash?: number
          submitted_at?: string
          submitted_by?: string | null
          total_expense?: number
          total_income?: number
          year: number
        }
        Update: {
          closing_cash?: number
          created_at?: string
          id?: string
          locked?: boolean
          month?: number
          note?: string | null
          opening_cash?: number
          submitted_at?: string
          submitted_by?: string | null
          total_expense?: number
          total_income?: number
          year?: number
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
          fiscal_year_start_month: number
          id: number
          loan_receipt_footer_bn: string | null
          loan_receipt_footer_en: string | null
          loan_receipt_header_bn: string | null
          loan_receipt_header_en: string | null
          loan_receipt_no_format: string | null
          logo_url: string | null
          mobile: string | null
          pdf_footer_show_address: boolean
          pdf_footer_show_contact: boolean
          pdf_footer_text: string | null
          penalty_grace_days: number
          penalty_type: string
          penalty_value: number
          registration_no: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name?: string
          company_name_bn?: string | null
          default_loan_interest?: number
          email?: string | null
          fiscal_year_start_month?: number
          id?: number
          loan_receipt_footer_bn?: string | null
          loan_receipt_footer_en?: string | null
          loan_receipt_header_bn?: string | null
          loan_receipt_header_en?: string | null
          loan_receipt_no_format?: string | null
          logo_url?: string | null
          mobile?: string | null
          pdf_footer_show_address?: boolean
          pdf_footer_show_contact?: boolean
          pdf_footer_text?: string | null
          penalty_grace_days?: number
          penalty_type?: string
          penalty_value?: number
          registration_no?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string
          company_name_bn?: string | null
          default_loan_interest?: number
          email?: string | null
          fiscal_year_start_month?: number
          id?: number
          loan_receipt_footer_bn?: string | null
          loan_receipt_footer_en?: string | null
          loan_receipt_header_bn?: string | null
          loan_receipt_header_en?: string | null
          loan_receipt_no_format?: string | null
          logo_url?: string | null
          mobile?: string | null
          pdf_footer_show_address?: boolean
          pdf_footer_show_contact?: boolean
          pdf_footer_text?: string | null
          penalty_grace_days?: number
          penalty_type?: string
          penalty_value?: number
          registration_no?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      demo_operations_log: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          ip: string | null
          modules: string[]
          size: number | null
          success: boolean
          summary: Json | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip?: string | null
          modules?: string[]
          size?: number | null
          success?: boolean
          summary?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip?: string | null
          modules?: string[]
          size?: number | null
          success?: boolean
          summary?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      developer_update_logs: {
        Row: {
          action: string
          commit_message: string | null
          commit_sha: string | null
          created_at: string
          id: string
          note: string | null
          release_tag: string | null
          repo_url: string
          status: string | null
          user_id: string
        }
        Insert: {
          action: string
          commit_message?: string | null
          commit_sha?: string | null
          created_at?: string
          id?: string
          note?: string | null
          release_tag?: string | null
          repo_url: string
          status?: string | null
          user_id: string
        }
        Update: {
          action?: string
          commit_message?: string | null
          commit_sha?: string | null
          created_at?: string
          id?: string
          note?: string | null
          release_tag?: string | null
          repo_url?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      districts: {
        Row: {
          code: string | null
          created_at: string
          division_id: string | null
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          division_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          division_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expense_date: string
          head: string
          id: string
          method: string | null
          note: string | null
          office_id: string | null
          payee: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expense_date?: string
          head: string
          id?: string
          method?: string | null
          note?: string | null
          office_id?: string | null
          payee?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expense_date?: string
          head?: string
          id?: string
          method?: string | null
          note?: string | null
          office_id?: string | null
          payee?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      farmer_login_attempts: {
        Row: {
          created_at: string
          error_reason: string | null
          farmer_id: string | null
          id: string
          identifier: string
          ip: string | null
          office_id: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          error_reason?: string | null
          farmer_id?: string | null
          id?: string
          identifier: string
          ip?: string | null
          office_id?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          error_reason?: string | null
          farmer_id?: string | null
          id?: string
          identifier?: string
          ip?: string | null
          office_id?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      farmer_notes: {
        Row: {
          created_at: string
          created_by: string | null
          farmer_id: string
          id: string
          note: string
          pinned: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          farmer_id: string
          id?: string
          note: string
          pinned?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          farmer_id?: string
          id?: string
          note?: string
          pinned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_notes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_notes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_otps: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          farmer_id: string
          id: string
          ip: string | null
          mobile_masked: string | null
          otp_hash: string
          used: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at: string
          farmer_id: string
          id?: string
          ip?: string | null
          mobile_masked?: string | null
          otp_hash: string
          used?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          farmer_id?: string
          id?: string
          ip?: string | null
          mobile_masked?: string | null
          otp_hash?: string
          used?: boolean
        }
        Relationships: []
      }
      farmer_portal_sessions: {
        Row: {
          created_at: string
          expires_at: string
          farmer_id: string
          id: string
          ip: string | null
          last_used_at: string | null
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          farmer_id: string
          id?: string
          ip?: string | null
          last_used_at?: string | null
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          farmer_id?: string
          id?: string
          ip?: string | null
          last_used_at?: string | null
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      farmer_rejections: {
        Row: {
          attempted: Json
          created_at: string
          error_message: string
          failed_level: string
          farmer_id: string | null
          id: string
          office_id: string | null
          operation: string
          reason: string
          user_id: string | null
        }
        Insert: {
          attempted: Json
          created_at?: string
          error_message: string
          failed_level: string
          farmer_id?: string | null
          id?: string
          office_id?: string | null
          operation: string
          reason: string
          user_id?: string | null
        }
        Update: {
          attempted?: Json
          created_at?: string
          error_message?: string
          failed_level?: string
          farmer_id?: string | null
          id?: string
          office_id?: string | null
          operation?: string
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      farmer_savings_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          expected_interest: number
          expected_total: number
          farmer_id: string
          id: string
          maturity_amount: number
          office_id: string | null
          plan_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          expected_interest?: number
          expected_total?: number
          farmer_id: string
          id?: string
          maturity_amount?: number
          office_id?: string | null
          plan_id: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          expected_interest?: number
          expected_total?: number
          farmer_id?: string
          id?: string
          maturity_amount?: number
          office_id?: string | null
          plan_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_savings_plans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_savings_plans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_savings_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "savings_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      farmers: {
        Row: {
          account_number: string | null
          address: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          district: string | null
          district_id: string | null
          division: string | null
          division_id: string | null
          farmer_code: string
          father_name: string | null
          id: string
          is_voter: boolean
          member_no: string | null
          mobile: string | null
          mother_name: string | null
          mouza_id: string | null
          name_bn: string | null
          name_en: string
          nid: string | null
          nominee_address: string | null
          nominee_mobile: string | null
          nominee_name: string | null
          nominee_nid: string | null
          nominee_relation: string | null
          office_id: string | null
          photo_url: string | null
          post_office: string | null
          status: string
          union_id: string | null
          upazila: string | null
          upazila_id: string | null
          updated_at: string
          village: string | null
          village_id: string | null
          voter_cancel_reason: string | null
          voter_cancelled_at: string | null
          voter_cancelled_by: string | null
          voter_number: string | null
          voter_reactivate_reason: string | null
          voter_reactivated_at: string | null
          voter_reactivated_by: string | null
          ward_id: string | null
        }
        Insert: {
          account_number?: string | null
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district?: string | null
          district_id?: string | null
          division?: string | null
          division_id?: string | null
          farmer_code: string
          father_name?: string | null
          id?: string
          is_voter?: boolean
          member_no?: string | null
          mobile?: string | null
          mother_name?: string | null
          mouza_id?: string | null
          name_bn?: string | null
          name_en: string
          nid?: string | null
          nominee_address?: string | null
          nominee_mobile?: string | null
          nominee_name?: string | null
          nominee_nid?: string | null
          nominee_relation?: string | null
          office_id?: string | null
          photo_url?: string | null
          post_office?: string | null
          status?: string
          union_id?: string | null
          upazila?: string | null
          upazila_id?: string | null
          updated_at?: string
          village?: string | null
          village_id?: string | null
          voter_cancel_reason?: string | null
          voter_cancelled_at?: string | null
          voter_cancelled_by?: string | null
          voter_number?: string | null
          voter_reactivate_reason?: string | null
          voter_reactivated_at?: string | null
          voter_reactivated_by?: string | null
          ward_id?: string | null
        }
        Update: {
          account_number?: string | null
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district?: string | null
          district_id?: string | null
          division?: string | null
          division_id?: string | null
          farmer_code?: string
          father_name?: string | null
          id?: string
          is_voter?: boolean
          member_no?: string | null
          mobile?: string | null
          mother_name?: string | null
          mouza_id?: string | null
          name_bn?: string | null
          name_en?: string
          nid?: string | null
          nominee_address?: string | null
          nominee_mobile?: string | null
          nominee_name?: string | null
          nominee_nid?: string | null
          nominee_relation?: string | null
          office_id?: string | null
          photo_url?: string | null
          post_office?: string | null
          status?: string
          union_id?: string | null
          upazila?: string | null
          upazila_id?: string | null
          updated_at?: string
          village?: string | null
          village_id?: string | null
          voter_cancel_reason?: string | null
          voter_cancelled_at?: string | null
          voter_cancelled_by?: string | null
          voter_number?: string | null
          voter_reactivate_reason?: string | null
          voter_reactivated_at?: string | null
          voter_reactivated_by?: string | null
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmers_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmers_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmers_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmers_upazila_id_fkey"
            columns: ["upazila_id"]
            isOneToOne: false
            referencedRelation: "upazilas"
            referencedColumns: ["id"]
          },
        ]
      }
      import_audit_logs: {
        Row: {
          created_at: string
          error_report_url: string | null
          id: string
          mode: string
          module: string
          office_id: string | null
          rows_failed: number
          rows_inserted: number
          rows_processed: number
          rows_updated: number
          summary: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_report_url?: string | null
          id?: string
          mode?: string
          module: string
          office_id?: string | null
          rows_failed?: number
          rows_inserted?: number
          rows_processed?: number
          rows_updated?: number
          summary?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_report_url?: string | null
          id?: string
          mode?: string
          module?: string
          office_id?: string | null
          rows_failed?: number
          rows_inserted?: number
          rows_processed?: number
          rows_updated?: number
          summary?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      irrigation_categories: {
        Row: {
          allow_manual_negotiation: boolean
          calculation_basis: string
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name_bn: string | null
          name_en: string | null
          office_id: string | null
          updated_at: string
        }
        Insert: {
          allow_manual_negotiation?: boolean
          calculation_basis?: string
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name_bn?: string | null
          name_en?: string | null
          office_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_manual_negotiation?: boolean
          calculation_basis?: string
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name_bn?: string | null
          name_en?: string | null
          office_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      irrigation_category_rates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          irrigation_category_id: string
          irrigation_season_id: string
          is_negotiable: boolean
          office_id: string | null
          rate: number
          rate_type: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          irrigation_category_id: string
          irrigation_season_id: string
          is_negotiable?: boolean
          office_id?: string | null
          rate?: number
          rate_type?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          irrigation_category_id?: string
          irrigation_season_id?: string
          is_negotiable?: boolean
          office_id?: string | null
          rate?: number
          rate_type?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_category_rates_irrigation_category_id_fkey"
            columns: ["irrigation_category_id"]
            isOneToOne: false
            referencedRelation: "irrigation_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigation_charge_settings: {
        Row: {
          auto_apply_delay_fee: boolean
          canal_percent: number
          created_at: string
          created_by: string | null
          delay_fee_percent: number
          grace_days: number
          id: string
          maintenance_percent: number
          office_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_apply_delay_fee?: boolean
          canal_percent?: number
          created_at?: string
          created_by?: string | null
          delay_fee_percent?: number
          grace_days?: number
          id?: string
          maintenance_percent?: number
          office_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_apply_delay_fee?: boolean
          canal_percent?: number
          created_at?: string
          created_by?: string | null
          delay_fee_percent?: number
          grace_days?: number
          id?: string
          maintenance_percent?: number
          office_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      irrigation_charges: {
        Row: {
          base_charge: number
          basis: Database["public"]["Enums"]["irrigation_basis"]
          canal_charge: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
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
          patwari_id: string | null
          penalty_amount: number
          previous_due_brought: number
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
          deleted_at?: string | null
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
          patwari_id?: string | null
          penalty_amount?: number
          previous_due_brought?: number
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
          deleted_at?: string | null
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
          patwari_id?: string | null
          penalty_amount?: number
          previous_due_brought?: number
          quantity?: number
          season_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_charges_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
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
            foreignKeyName: "irrigation_charges_land_id_fkey"
            columns: ["land_id"]
            isOneToOne: false
            referencedRelation: "lands_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_charges_patwari_id_fkey"
            columns: ["patwari_id"]
            isOneToOne: false
            referencedRelation: "patwaris"
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
      irrigation_delay_fee_audit: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          invoice_id: string
          modified_amount: number
          office_id: string | null
          original_amount: number
          payment_id: string | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          modified_amount?: number
          office_id?: string | null
          original_amount?: number
          payment_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          modified_amount?: number
          office_id?: string | null
          original_amount?: number
          payment_id?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      irrigation_due_promises: {
        Row: {
          approved_by: string | null
          created_at: string
          farmer_id: string
          fulfilled_at: string | null
          id: string
          office_id: string | null
          payment_id: string | null
          previous_due_amount: number
          promise_date: string
          remarks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          farmer_id: string
          fulfilled_at?: string | null
          id?: string
          office_id?: string | null
          payment_id?: string | null
          previous_due_amount?: number
          promise_date: string
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          farmer_id?: string
          fulfilled_at?: string | null
          id?: string
          office_id?: string | null
          payment_id?: string | null
          previous_due_amount?: number
          promise_date?: string
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_due_promises_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "irrigation_due_promises_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigation_invoice_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          invoice_id: string
          new_values: Json | null
          note: string | null
          office_id: string | null
          old_values: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          invoice_id: string
          new_values?: Json | null
          note?: string | null
          office_id?: string | null
          old_values?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          invoice_id?: string
          new_values?: Json | null
          note?: string | null
          office_id?: string | null
          old_values?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_invoice_audit_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "irrigation_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigation_invoice_payments: {
        Row: {
          canal_collected: number
          collected_amount: number
          created_at: string
          created_by: string | null
          current_invoice_collected: number
          delay_fee_collected: number
          delay_fee_original: number | null
          delay_fee_override_reason: string | null
          id: string
          invoice_id: string
          irrigation_collected: number
          maintenance_collected: number
          office_id: string | null
          payment_id: string | null
          previous_due_collected: number
        }
        Insert: {
          canal_collected?: number
          collected_amount?: number
          created_at?: string
          created_by?: string | null
          current_invoice_collected?: number
          delay_fee_collected?: number
          delay_fee_original?: number | null
          delay_fee_override_reason?: string | null
          id?: string
          invoice_id: string
          irrigation_collected?: number
          maintenance_collected?: number
          office_id?: string | null
          payment_id?: string | null
          previous_due_collected?: number
        }
        Update: {
          canal_collected?: number
          collected_amount?: number
          created_at?: string
          created_by?: string | null
          current_invoice_collected?: number
          delay_fee_collected?: number
          delay_fee_original?: number | null
          delay_fee_override_reason?: string | null
          id?: string
          invoice_id?: string
          irrigation_collected?: number
          maintenance_collected?: number
          office_id?: string | null
          payment_id?: string | null
          previous_due_collected?: number
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "irrigation_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigation_invoices: {
        Row: {
          applied_rate: number | null
          calculation_snapshot: Json | null
          canal_amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          delay_fee: number
          deleted_at: string | null
          due_amount: number
          due_date: string
          farmer_id: string
          generated_at: string
          generated_by: string | null
          id: string
          invoice_no: string
          invoice_status: Database["public"]["Enums"]["invoice_status"]
          irrigation_amount: number
          irrigation_category_id: string | null
          irrigation_category_name: string | null
          is_borga: boolean
          is_manual_rate: boolean
          land_id: string
          land_type_id: string | null
          land_type_name: string | null
          maintenance_amount: number
          manual_rate_reason: string | null
          note: string | null
          office_id: string | null
          original_standard_rate: number | null
          other_charge: number
          override_reason: string | null
          owner_farmer_id: string
          paid_amount: number
          payable_amount: number
          rate_source: string | null
          recalculated_at: string | null
          recalculated_by: string | null
          season_id: string
          season_rate: number | null
          updated_at: string
        }
        Insert: {
          applied_rate?: number | null
          calculation_snapshot?: Json | null
          canal_amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          delay_fee?: number
          deleted_at?: string | null
          due_amount?: number
          due_date: string
          farmer_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          invoice_no: string
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          irrigation_amount?: number
          irrigation_category_id?: string | null
          irrigation_category_name?: string | null
          is_borga?: boolean
          is_manual_rate?: boolean
          land_id: string
          land_type_id?: string | null
          land_type_name?: string | null
          maintenance_amount?: number
          manual_rate_reason?: string | null
          note?: string | null
          office_id?: string | null
          original_standard_rate?: number | null
          other_charge?: number
          override_reason?: string | null
          owner_farmer_id: string
          paid_amount?: number
          payable_amount?: number
          rate_source?: string | null
          recalculated_at?: string | null
          recalculated_by?: string | null
          season_id: string
          season_rate?: number | null
          updated_at?: string
        }
        Update: {
          applied_rate?: number | null
          calculation_snapshot?: Json | null
          canal_amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          delay_fee?: number
          deleted_at?: string | null
          due_amount?: number
          due_date?: string
          farmer_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          invoice_no?: string
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          irrigation_amount?: number
          irrigation_category_id?: string | null
          irrigation_category_name?: string | null
          is_borga?: boolean
          is_manual_rate?: boolean
          land_id?: string
          land_type_id?: string | null
          land_type_name?: string | null
          maintenance_amount?: number
          manual_rate_reason?: string | null
          note?: string | null
          office_id?: string | null
          original_standard_rate?: number | null
          other_charge?: number
          override_reason?: string | null
          owner_farmer_id?: string
          paid_amount?: number
          payable_amount?: number
          rate_source?: string | null
          recalculated_at?: string | null
          recalculated_by?: string | null
          season_id?: string
          season_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_invoices_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "irrigation_invoices_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_invoices_land_id_fkey"
            columns: ["land_id"]
            isOneToOne: false
            referencedRelation: "lands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_invoices_land_id_fkey"
            columns: ["land_id"]
            isOneToOne: false
            referencedRelation: "lands_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_invoices_land_type_id_fkey"
            columns: ["land_type_id"]
            isOneToOne: false
            referencedRelation: "land_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_invoices_owner_farmer_id_fkey"
            columns: ["owner_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "irrigation_invoices_owner_farmer_id_fkey"
            columns: ["owner_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_invoices_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigation_rate_audit_logs: {
        Row: {
          action: string
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          id: string
          ip: string | null
          irrigation_season_id: string | null
          land_type_id: string | null
          new_rate: number | null
          office_id: string | null
          old_rate: number | null
        }
        Insert: {
          action?: string
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          ip?: string | null
          irrigation_season_id?: string | null
          land_type_id?: string | null
          new_rate?: number | null
          office_id?: string | null
          old_rate?: number | null
        }
        Update: {
          action?: string
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          ip?: string | null
          irrigation_season_id?: string | null
          land_type_id?: string | null
          new_rate?: number | null
          office_id?: string | null
          old_rate?: number | null
        }
        Relationships: []
      }
      irrigation_rate_overrides: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          irrigation_invoice_id: string
          office_id: string | null
          original_rate: number
          overridden_rate: number
          override_reason: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          irrigation_invoice_id: string
          office_id?: string | null
          original_rate?: number
          overridden_rate?: number
          override_reason?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          irrigation_invoice_id?: string
          office_id?: string | null
          original_rate?: number
          overridden_rate?: number
          override_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_rate_overrides_invoice_fkey"
            columns: ["irrigation_invoice_id"]
            isOneToOne: false
            referencedRelation: "irrigation_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigation_rates: {
        Row: {
          base_rate: number
          basis: Database["public"]["Enums"]["irrigation_basis"]
          canal_charge: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          maintenance_charge: number
          note: string | null
          office_id: string | null
          other_charge: number
          season_id: string
          updated_at: string
        }
        Insert: {
          base_rate?: number
          basis?: Database["public"]["Enums"]["irrigation_basis"]
          canal_charge?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          maintenance_charge?: number
          note?: string | null
          office_id?: string | null
          other_charge?: number
          season_id: string
          updated_at?: string
        }
        Update: {
          base_rate?: number
          basis?: Database["public"]["Enums"]["irrigation_basis"]
          canal_charge?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          maintenance_charge?: number
          note?: string | null
          office_id?: string | null
          other_charge?: number
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_rates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_rates_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigation_season_rates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          irrigation_season_id: string
          land_type_id: string
          office_id: string | null
          rate_per_shotok: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          irrigation_season_id: string
          land_type_id: string
          office_id?: string | null
          rate_per_shotok?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          irrigation_season_id?: string
          land_type_id?: string
          office_id?: string | null
          rate_per_shotok?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_season_rates_irrigation_season_id_fkey"
            columns: ["irrigation_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_season_rates_land_type_id_fkey"
            columns: ["land_type_id"]
            isOneToOne: false
            referencedRelation: "land_types"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigation_season_types: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          name_en: string | null
          office_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          name_en?: string | null
          office_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          name_en?: string | null
          office_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      irrigation_sms_logs: {
        Row: {
          created_at: string
          delivered_at: string | null
          failure_reason: string | null
          farmer_id: string | null
          gateway_response: Json | null
          id: string
          irrigation_invoice_id: string | null
          message: string | null
          mobile: string | null
          office_id: string | null
          retry_count: number
          sent_at: string | null
          sent_by: string | null
          sms_type: string
          status: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          failure_reason?: string | null
          farmer_id?: string | null
          gateway_response?: Json | null
          id?: string
          irrigation_invoice_id?: string | null
          message?: string | null
          mobile?: string | null
          office_id?: string | null
          retry_count?: number
          sent_at?: string | null
          sent_by?: string | null
          sms_type: string
          status?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          failure_reason?: string | null
          farmer_id?: string | null
          gateway_response?: Json | null
          id?: string
          irrigation_invoice_id?: string | null
          message?: string | null
          mobile?: string | null
          office_id?: string | null
          retry_count?: number
          sent_at?: string | null
          sent_by?: string | null
          sms_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_sms_logs_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "irrigation_sms_logs_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_sms_logs_irrigation_invoice_id_fkey"
            columns: ["irrigation_invoice_id"]
            isOneToOne: false
            referencedRelation: "irrigation_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_sms_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          entry_date: string
          id: string
          office_id: string | null
          posted: boolean
          posted_at: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          office_id?: string | null
          posted?: boolean
          posted_at?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          office_id?: string | null
          posted?: boolean
          posted_at?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_id: string
          position: number
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_id: string
          position?: number
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      land_change_log: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          farmer_id: string | null
          id: string
          land_id: string | null
          new_values: Json | null
          office_id: string | null
          old_values: Json | null
          remarks: string | null
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          farmer_id?: string | null
          id?: string
          land_id?: string | null
          new_values?: Json | null
          office_id?: string | null
          old_values?: Json | null
          remarks?: string | null
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          farmer_id?: string | null
          id?: string
          land_id?: string | null
          new_values?: Json | null
          office_id?: string | null
          old_values?: Json | null
          remarks?: string | null
        }
        Relationships: []
      }
      land_history: {
        Row: {
          created_at: string
          crop: string | null
          cultivator_farmer_id: string | null
          dag_no: string | null
          farmer_id: string
          field_type: string | null
          fiscal_year: number
          id: string
          land_id: string | null
          land_size: number
          mouza: string | null
          office_id: string | null
          owner_type: string | null
          recorded_by: string | null
          remarks: string | null
          season: string | null
          yield_amount: number | null
          yield_unit: string | null
        }
        Insert: {
          created_at?: string
          crop?: string | null
          cultivator_farmer_id?: string | null
          dag_no?: string | null
          farmer_id: string
          field_type?: string | null
          fiscal_year: number
          id?: string
          land_id?: string | null
          land_size: number
          mouza?: string | null
          office_id?: string | null
          owner_type?: string | null
          recorded_by?: string | null
          remarks?: string | null
          season?: string | null
          yield_amount?: number | null
          yield_unit?: string | null
        }
        Update: {
          created_at?: string
          crop?: string | null
          cultivator_farmer_id?: string | null
          dag_no?: string | null
          farmer_id?: string
          field_type?: string | null
          fiscal_year?: number
          id?: string
          land_id?: string | null
          land_size?: number
          mouza?: string | null
          office_id?: string | null
          owner_type?: string | null
          recorded_by?: string | null
          remarks?: string | null
          season?: string | null
          yield_amount?: number | null
          yield_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "land_history_cultivator_farmer_id_fkey"
            columns: ["cultivator_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "land_history_cultivator_farmer_id_fkey"
            columns: ["cultivator_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_history_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "land_history_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_history_land_id_fkey"
            columns: ["land_id"]
            isOneToOne: false
            referencedRelation: "lands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_history_land_id_fkey"
            columns: ["land_id"]
            isOneToOne: false
            referencedRelation: "lands_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_history_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      land_relations: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          land_id: string
          note: string | null
          office_id: string | null
          owner_farmer_id: string
          share_percentage: number
          sharecropper_farmer_id: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          land_id: string
          note?: string | null
          office_id?: string | null
          owner_farmer_id: string
          share_percentage?: number
          sharecropper_farmer_id?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          land_id?: string
          note?: string | null
          office_id?: string | null
          owner_farmer_id?: string
          share_percentage?: number
          sharecropper_farmer_id?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "land_relations_land_id_fkey"
            columns: ["land_id"]
            isOneToOne: false
            referencedRelation: "lands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_relations_land_id_fkey"
            columns: ["land_id"]
            isOneToOne: false
            referencedRelation: "lands_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_relations_owner_farmer_id_fkey"
            columns: ["owner_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "land_relations_owner_farmer_id_fkey"
            columns: ["owner_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_relations_sharecropper_farmer_id_fkey"
            columns: ["sharecropper_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "land_relations_sharecropper_farmer_id_fkey"
            columns: ["sharecropper_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      land_transfer_recipients: {
        Row: {
          area_decimal: number
          created_at: string
          id: string
          new_land_id: string | null
          recipient_farmer_id: string
          transfer_id: string
        }
        Insert: {
          area_decimal: number
          created_at?: string
          id?: string
          new_land_id?: string | null
          recipient_farmer_id: string
          transfer_id: string
        }
        Update: {
          area_decimal?: number
          created_at?: string
          id?: string
          new_land_id?: string | null
          recipient_farmer_id?: string
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "land_transfer_recipients_new_land_id_fkey"
            columns: ["new_land_id"]
            isOneToOne: false
            referencedRelation: "lands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_transfer_recipients_new_land_id_fkey"
            columns: ["new_land_id"]
            isOneToOne: false
            referencedRelation: "lands_with_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_transfer_recipients_recipient_farmer_id_fkey"
            columns: ["recipient_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "land_transfer_recipients_recipient_farmer_id_fkey"
            columns: ["recipient_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_transfer_recipients_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "land_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      land_transfers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          office_id: string | null
          remark: string | null
          source_farmer_id: string
          source_land_id: string
          transfer_type: string
          transferred_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          office_id?: string | null
          remark?: string | null
          source_farmer_id: string
          source_land_id: string
          transfer_type: string
          transferred_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          office_id?: string | null
          remark?: string | null
          source_farmer_id?: string
          source_land_id?: string
          transfer_type?: string
          transferred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "land_transfers_source_farmer_id_fkey"
            columns: ["source_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "land_transfers_source_farmer_id_fkey"
            columns: ["source_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_transfers_source_land_id_fkey"
            columns: ["source_land_id"]
            isOneToOne: false
            referencedRelation: "lands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "land_transfers_source_land_id_fkey"
            columns: ["source_land_id"]
            isOneToOne: false
            referencedRelation: "lands_with_location"
            referencedColumns: ["id"]
          },
        ]
      }
      land_types: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          name_en: string | null
          office_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          name_en?: string | null
          office_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          name_en?: string | null
          office_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      lands: {
        Row: {
          created_at: string
          dag_no: string | null
          dag_numbers: string[]
          deleted_at: string | null
          district_id: string | null
          division_id: string | null
          farmer_id: string
          field_type: Database["public"]["Enums"]["field_type"]
          id: string
          land_size: number
          land_type_id: string | null
          mouza: string | null
          mouza_id: string | null
          office_id: string | null
          owner_farmer_id: string | null
          owner_type: Database["public"]["Enums"]["owner_type"]
          patwari_id: string | null
          upazila_id: string | null
        }
        Insert: {
          created_at?: string
          dag_no?: string | null
          dag_numbers?: string[]
          deleted_at?: string | null
          district_id?: string | null
          division_id?: string | null
          farmer_id: string
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          land_size?: number
          land_type_id?: string | null
          mouza?: string | null
          mouza_id?: string | null
          office_id?: string | null
          owner_farmer_id?: string | null
          owner_type?: Database["public"]["Enums"]["owner_type"]
          patwari_id?: string | null
          upazila_id?: string | null
        }
        Update: {
          created_at?: string
          dag_no?: string | null
          dag_numbers?: string[]
          deleted_at?: string | null
          district_id?: string | null
          division_id?: string | null
          farmer_id?: string
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          land_size?: number
          land_type_id?: string | null
          mouza?: string | null
          mouza_id?: string | null
          office_id?: string | null
          owner_farmer_id?: string | null
          owner_type?: Database["public"]["Enums"]["owner_type"]
          patwari_id?: string | null
          upazila_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lands_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "lands_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lands_land_type_id_fkey"
            columns: ["land_type_id"]
            isOneToOne: false
            referencedRelation: "land_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lands_owner_farmer_id_fkey"
            columns: ["owner_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "lands_owner_farmer_id_fkey"
            columns: ["owner_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lands_patwari_id_fkey"
            columns: ["patwari_id"]
            isOneToOne: false
            referencedRelation: "patwaris"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          credit: number
          debit: number
          description: string | null
          entry_date: string
          id: string
          office_id: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          description?: string | null
          entry_date?: string
          id?: string
          office_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          description?: string | null
          entry_date?: string
          id?: string
          office_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_delay_fee_settings: {
        Row: {
          allow_partial_installment: boolean
          auto_apply: boolean
          created_at: string
          created_by: string | null
          daily_penalty: number
          enforcement_mode: string
          grace_days: number
          id: string
          max_penalty: number | null
          mode: string
          office_id: string | null
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          allow_partial_installment?: boolean
          auto_apply?: boolean
          created_at?: string
          created_by?: string | null
          daily_penalty?: number
          enforcement_mode?: string
          grace_days?: number
          id?: string
          max_penalty?: number | null
          mode?: string
          office_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Update: {
          allow_partial_installment?: boolean
          auto_apply?: boolean
          created_at?: string
          created_by?: string | null
          daily_penalty?: number
          enforcement_mode?: string
          grace_days?: number
          id?: string
          max_penalty?: number | null
          mode?: string
          office_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: []
      }
      loan_guarantors: {
        Row: {
          created_at: string
          farmer_id: string | null
          father_name: string | null
          id: string
          loan_id: string
          mobile: string | null
          name: string
          nid: string | null
          office_id: string | null
          village: string | null
        }
        Insert: {
          created_at?: string
          farmer_id?: string | null
          father_name?: string | null
          id?: string
          loan_id: string
          mobile?: string | null
          name: string
          nid?: string | null
          office_id?: string | null
          village?: string | null
        }
        Update: {
          created_at?: string
          farmer_id?: string | null
          father_name?: string | null
          id?: string
          loan_id?: string
          mobile?: string | null
          name?: string
          nid?: string | null
          office_id?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_guarantors_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "loan_guarantors_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_guarantors_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_installment_delay_audit: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          installment_id: string
          loan_id: string
          modified_amount: number
          office_id: string | null
          original_amount: number
          payment_id: string | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          installment_id: string
          loan_id: string
          modified_amount?: number
          office_id?: string | null
          original_amount?: number
          payment_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          installment_id?: string
          loan_id?: string
          modified_amount?: number
          office_id?: string | null
          original_amount?: number
          payment_id?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      loan_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_no: number
          loan_id: string
          office_id: string | null
          overdue_days: number
          paid_amount: number
          paid_on: string | null
          penalty_amount: number
          penalty_rule_snapshot: Json | null
          status: Database["public"]["Enums"]["installment_status"]
          strict_validation_override: boolean
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date: string
          id?: string
          installment_no: number
          loan_id: string
          office_id?: string | null
          overdue_days?: number
          paid_amount?: number
          paid_on?: string | null
          penalty_amount?: number
          penalty_rule_snapshot?: Json | null
          status?: Database["public"]["Enums"]["installment_status"]
          strict_validation_override?: boolean
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_no?: number
          loan_id?: string
          office_id?: string | null
          overdue_days?: number
          paid_amount?: number
          paid_on?: string | null
          penalty_amount?: number
          penalty_rule_snapshot?: Json | null
          status?: Database["public"]["Enums"]["installment_status"]
          strict_validation_override?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payments: {
        Row: {
          amount: number
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          collected_by: string | null
          created_at: string
          id: string
          loan_id: string
          note: string | null
          office_id: string | null
          override_by: string | null
          override_reason: string | null
          paid_on: string
          penalty_collected: number
          receipt_no: string | null
          status: Database["public"]["Enums"]["loan_payment_status"]
        }
        Insert: {
          amount: number
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          collected_by?: string | null
          created_at?: string
          id?: string
          loan_id: string
          note?: string | null
          office_id?: string | null
          override_by?: string | null
          override_reason?: string | null
          paid_on?: string
          penalty_collected?: number
          receipt_no?: string | null
          status?: Database["public"]["Enums"]["loan_payment_status"]
        }
        Update: {
          amount?: number
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          collected_by?: string | null
          created_at?: string
          id?: string
          loan_id?: string
          note?: string | null
          office_id?: string | null
          override_by?: string | null
          override_reason?: string | null
          paid_on?: string
          penalty_collected?: number
          receipt_no?: string | null
          status?: Database["public"]["Enums"]["loan_payment_status"]
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
      loan_plans: {
        Row: {
          created_at: string
          created_by: string | null
          duration_months: number
          grace_period_days: number
          id: string
          installment_type: Database["public"]["Enums"]["loan_installment_type"]
          interest_rate: number
          is_active: boolean
          name: string
          name_bn: string | null
          office_id: string | null
          penalty_type: Database["public"]["Enums"]["loan_penalty_type"]
          penalty_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_months: number
          grace_period_days?: number
          id?: string
          installment_type?: Database["public"]["Enums"]["loan_installment_type"]
          interest_rate?: number
          is_active?: boolean
          name: string
          name_bn?: string | null
          office_id?: string | null
          penalty_type?: Database["public"]["Enums"]["loan_penalty_type"]
          penalty_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_months?: number
          grace_period_days?: number
          id?: string
          installment_type?: Database["public"]["Enums"]["loan_installment_type"]
          interest_rate?: number
          is_active?: boolean
          name?: string
          name_bn?: string | null
          office_id?: string | null
          penalty_type?: Database["public"]["Enums"]["loan_penalty_type"]
          penalty_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          approval_note: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          farmer_id: string
          fully_paid_on: string | null
          id: string
          installment_amount: number | null
          interest_enabled: boolean
          interest_rate: number
          is_temporary: boolean
          issued_on: string
          loan_no: string | null
          next_due_on: string | null
          note: string | null
          office_id: string | null
          plan_id: string | null
          principal: number
          repayment_mode: string
          status: Database["public"]["Enums"]["loan_status"]
          temp_purpose: string | null
          total_due: number | null
          total_payable: number
          updated_at: string
        }
        Insert: {
          approval_note?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farmer_id: string
          fully_paid_on?: string | null
          id?: string
          installment_amount?: number | null
          interest_enabled?: boolean
          interest_rate?: number
          is_temporary?: boolean
          issued_on?: string
          loan_no?: string | null
          next_due_on?: string | null
          note?: string | null
          office_id?: string | null
          plan_id?: string | null
          principal: number
          repayment_mode?: string
          status?: Database["public"]["Enums"]["loan_status"]
          temp_purpose?: string | null
          total_due?: number | null
          total_payable?: number
          updated_at?: string
        }
        Update: {
          approval_note?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          farmer_id?: string
          fully_paid_on?: string | null
          id?: string
          installment_amount?: number | null
          interest_enabled?: boolean
          interest_rate?: number
          is_temporary?: boolean
          issued_on?: string
          loan_no?: string | null
          next_due_on?: string | null
          note?: string | null
          office_id?: string | null
          plan_id?: string | null
          principal?: number
          repayment_mode?: string
          status?: Database["public"]["Enums"]["loan_status"]
          temp_purpose?: string | null
          total_due?: number | null
          total_payable?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "loan_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mouzas: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          upazila_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          upazila_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          upazila_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mouzas_upazila_id_fkey"
            columns: ["upazila_id"]
            isOneToOne: false
            referencedRelation: "upazilas"
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
          payment_priority: string[]
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
          payment_priority?: string[]
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
          payment_priority?: string[]
          registration_no?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patwaris: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          mobile: string | null
          mouza_id: string | null
          name: string
          name_bn: string | null
          nid: string | null
          note: string | null
          office_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          mouza_id?: string | null
          name: string
          name_bn?: string | null
          nid?: string | null
          note?: string | null
          office_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          mouza_id?: string | null
          name?: string
          name_bn?: string | null
          nid?: string | null
          note?: string | null
          office_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patwaris_mouza_id_fkey"
            columns: ["mouza_id"]
            isOneToOne: false
            referencedRelation: "mouzas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patwaris_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          office_id: string | null
          payment_id: string
          reference_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          office_id?: string | null
          payment_id: string
          reference_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          office_id?: string | null
          payment_id?: string
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string
          collected_by: string | null
          created_at: string
          deleted_at: string | null
          farmer_id: string
          id: string
          idempotency_key: string | null
          kind: Database["public"]["Enums"]["payment_kind"]
          method: string | null
          note: string | null
          office_id: string | null
          receipt_no: string | null
          receipt_url: string | null
          reference_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          verify_token: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          collected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          farmer_id: string
          id?: string
          idempotency_key?: string | null
          kind: Database["public"]["Enums"]["payment_kind"]
          method?: string | null
          note?: string | null
          office_id?: string | null
          receipt_no?: string | null
          receipt_url?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          verify_token?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          collected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          farmer_id?: string
          id?: string
          idempotency_key?: string | null
          kind?: Database["public"]["Enums"]["payment_kind"]
          method?: string | null
          note?: string | null
          office_id?: string | null
          receipt_no?: string | null
          receipt_url?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          verify_token?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          id: string
          module: string
          new_value: boolean | null
          old_value: boolean | null
          reason: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          id?: string
          module: string
          new_value?: boolean | null
          old_value?: boolean | null
          reason?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          module?: string
          new_value?: boolean | null
          old_value?: boolean | null
          reason?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          language_pref: string
          office_id: string | null
          receipt_options: Json | null
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
          receipt_options?: Json | null
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
          receipt_options?: Json | null
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
      public_payment_intents: {
        Row: {
          allocation_hint: string | null
          amount: number
          created_at: string
          farmer_code: string
          id: string
          note: string | null
          office_id: string | null
          payment_id: string | null
          phone: string | null
          processed_at: string | null
          processed_by: string | null
          status: string
        }
        Insert: {
          allocation_hint?: string | null
          amount: number
          created_at?: string
          farmer_code: string
          id?: string
          note?: string | null
          office_id?: string | null
          payment_id?: string | null
          phone?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
        }
        Update: {
          allocation_hint?: string | null
          amount?: number
          created_at?: string
          farmer_code?: string
          id?: string
          note?: string | null
          office_id?: string | null
          payment_id?: string | null
          phone?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_payment_intents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_rotation_settings: {
        Row: {
          enabled: boolean
          grace_hours: number
          id: number
          interval_days: number
          last_run_at: string | null
          last_run_summary: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          grace_hours?: number
          id?: number
          interval_days?: number
          last_run_at?: string | null
          last_run_summary?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          grace_hours?: number
          id?: number
          interval_days?: number
          last_run_at?: string | null
          last_run_summary?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      qr_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          farmer_id: string
          id: string
          revoked: boolean
          rotated_from: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          farmer_id: string
          id?: string
          revoked?: boolean
          rotated_from?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          farmer_id?: string
          id?: string
          revoked?: boolean
          rotated_from?: string | null
          token?: string
        }
        Relationships: []
      }
      receipt_counters: {
        Row: {
          kind: string
          last_no: number
          updated_at: string
          year: number
        }
        Insert: {
          kind: string
          last_no?: number
          updated_at?: string
          year: number
        }
        Update: {
          kind?: string
          last_no?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      receipt_sequences: {
        Row: {
          kind: string
          last_no: number
          month: number
          office_id: string
          updated_at: string
          year: number
        }
        Insert: {
          kind: string
          last_no?: number
          month: number
          office_id: string
          updated_at?: string
          year: number
        }
        Update: {
          kind?: string
          last_no?: number
          month?: number
          office_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      receipt_settings: {
        Row: {
          accent_color: string
          footer_note: string
          footer_note_bn: string
          header_alignment: string
          id: number
          language: string
          paper_size: string
          show_logo: boolean
          show_office: boolean
          show_signature_line: boolean
          show_token_block: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_color?: string
          footer_note?: string
          footer_note_bn?: string
          header_alignment?: string
          id?: number
          language?: string
          paper_size?: string
          show_logo?: boolean
          show_office?: boolean
          show_signature_line?: boolean
          show_token_block?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_color?: string
          footer_note?: string
          footer_note_bn?: string
          header_alignment?: string
          id?: number
          language?: string
          paper_size?: string
          show_logo?: boolean
          show_office?: boolean
          show_signature_line?: boolean
          show_token_block?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number
          collected_by: string | null
          created_at: string
          farmer_id: string | null
          id: string
          kind: Database["public"]["Enums"]["receipt_kind"]
          method: string | null
          note: string | null
          office_id: string | null
          receipt_date: string
          receipt_no: string | null
          reference_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          collected_by?: string | null
          created_at?: string
          farmer_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["receipt_kind"]
          method?: string | null
          note?: string | null
          office_id?: string | null
          receipt_date?: string
          receipt_no?: string | null
          reference_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          collected_by?: string | null
          created_at?: string
          farmer_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["receipt_kind"]
          method?: string | null
          note?: string | null
          office_id?: string | null
          receipt_date?: string
          receipt_no?: string | null
          reference_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "receipts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_add: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_add?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_add?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      savings_plans: {
        Row: {
          created_at: string
          created_by: string | null
          duration_months: number
          id: string
          installment_amount: number
          installment_type: Database["public"]["Enums"]["savings_installment_type"]
          interest_rate: number
          is_active: boolean
          maturity_type: Database["public"]["Enums"]["savings_maturity_type"]
          name: string
          name_bn: string | null
          office_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_months: number
          id?: string
          installment_amount?: number
          installment_type?: Database["public"]["Enums"]["savings_installment_type"]
          interest_rate?: number
          is_active?: boolean
          maturity_type?: Database["public"]["Enums"]["savings_maturity_type"]
          name: string
          name_bn?: string | null
          office_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_months?: number
          id?: string
          installment_amount?: number
          installment_type?: Database["public"]["Enums"]["savings_installment_type"]
          interest_rate?: number
          is_active?: boolean
          maturity_type?: Database["public"]["Enums"]["savings_maturity_type"]
          name?: string
          name_bn?: string | null
          office_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      savings_transactions: {
        Row: {
          amount: number
          approved_by: string | null
          category: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          deleted_at: string | null
          farmer_id: string
          field_receipt_no: string | null
          id: string
          note: string | null
          office_id: string | null
          receipt_no: string | null
          reject_reason: string | null
          status: Database["public"]["Enums"]["approval_status"]
          txn_date: string
          type: Database["public"]["Enums"]["savings_txn_type"]
        }
        Insert: {
          amount: number
          approved_by?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          deleted_at?: string | null
          farmer_id: string
          field_receipt_no?: string | null
          id?: string
          note?: string | null
          office_id?: string | null
          receipt_no?: string | null
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          txn_date?: string
          type: Database["public"]["Enums"]["savings_txn_type"]
        }
        Update: {
          amount?: number
          approved_by?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          deleted_at?: string | null
          farmer_id?: string
          field_receipt_no?: string | null
          id?: string
          note?: string | null
          office_id?: string | null
          receipt_no?: string | null
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          txn_date?: string
          type?: Database["public"]["Enums"]["savings_txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "savings_transactions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "savings_transactions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_yearly_opening: {
        Row: {
          created_at: string
          farmer_id: string
          id: string
          office_id: string | null
          opening_balance: number
          year: number
        }
        Insert: {
          created_at?: string
          farmer_id: string
          id?: string
          office_id?: string | null
          opening_balance?: number
          year: number
        }
        Update: {
          created_at?: string
          farmer_id?: string
          id?: string
          office_id?: string | null
          opening_balance?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "savings_yearly_opening_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "savings_yearly_opening_farmer_id_fkey"
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
          due_date: string | null
          end_date: string | null
          fiscal_year: string | null
          id: string
          name: string | null
          season_type_id: string | null
          start_date: string | null
          status: string
          type: Database["public"]["Enums"]["season_type"]
          year: number
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          end_date?: string | null
          fiscal_year?: string | null
          id?: string
          name?: string | null
          season_type_id?: string | null
          start_date?: string | null
          status?: string
          type: Database["public"]["Enums"]["season_type"]
          year: number
        }
        Update: {
          created_at?: string
          due_date?: string | null
          end_date?: string | null
          fiscal_year?: string | null
          id?: string
          name?: string | null
          season_type_id?: string | null
          start_date?: string | null
          status?: string
          type?: Database["public"]["Enums"]["season_type"]
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_season_type_id_fkey"
            columns: ["season_type_id"]
            isOneToOne: false
            referencedRelation: "irrigation_season_types"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "shares_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string
          created_by: string | null
          delivered_at: string | null
          dlr_payload: Json | null
          event_type: string | null
          farmer_id: string | null
          id: string
          message: string
          mobile: string
          office_id: string | null
          provider_response: string | null
          provider_used: string | null
          reference_id: string | null
          reference_type: string | null
          retry_count: number
          sent_at: string | null
          status: string
          template_key: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          dlr_payload?: Json | null
          event_type?: string | null
          farmer_id?: string | null
          id?: string
          message: string
          mobile: string
          office_id?: string | null
          provider_response?: string | null
          provider_used?: string | null
          reference_id?: string | null
          reference_type?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          template_key?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          dlr_payload?: Json | null
          event_type?: string | null
          farmer_id?: string | null
          id?: string
          message?: string
          mobile?: string
          office_id?: string | null
          provider_response?: string | null
          provider_used?: string | null
          reference_id?: string | null
          reference_type?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          template_key?: string | null
        }
        Relationships: []
      }
      sms_office_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          office_id: string
          sender_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          office_id: string
          sender_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          office_id?: string
          sender_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sms_provider_secrets: {
        Row: {
          activated_at: string | null
          api_token: string
          dlr_url: string | null
          expires_at: string | null
          id: string
          label: string | null
          priority: number
          provider: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activated_at?: string | null
          api_token: string
          dlr_url?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          priority?: number
          provider: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activated_at?: string | null
          api_token?: string
          dlr_url?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          priority?: number
          provider?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sms_settings: {
        Row: {
          api_key_set: boolean
          config: Json
          enabled: boolean
          id: number
          language: string
          reminder_days_before: number
          send_on_due_reminder: boolean
          send_on_irrigation_payment: boolean
          send_on_loan_approved: boolean
          send_on_loan_payment: boolean
          send_on_qr_revoke: boolean
          send_on_qr_rotate: boolean
          send_on_savings_deposit: boolean
          send_on_savings_withdraw: boolean
          sender_id: string | null
          tpl_due_reminder: string
          tpl_due_reminder_en: string
          tpl_irrigation_payment: string
          tpl_irrigation_payment_en: string
          tpl_loan_approved: string
          tpl_loan_approved_en: string
          tpl_loan_payment: string
          tpl_loan_payment_en: string
          tpl_qr_revoke: string
          tpl_qr_revoke_en: string
          tpl_qr_rotate: string
          tpl_qr_rotate_en: string
          tpl_savings_deposit: string
          tpl_savings_deposit_en: string
          tpl_savings_withdraw: string
          tpl_savings_withdraw_en: string
          updated_at: string
        }
        Insert: {
          api_key_set?: boolean
          config?: Json
          enabled?: boolean
          id?: number
          language?: string
          reminder_days_before?: number
          send_on_due_reminder?: boolean
          send_on_irrigation_payment?: boolean
          send_on_loan_approved?: boolean
          send_on_loan_payment?: boolean
          send_on_qr_revoke?: boolean
          send_on_qr_rotate?: boolean
          send_on_savings_deposit?: boolean
          send_on_savings_withdraw?: boolean
          sender_id?: string | null
          tpl_due_reminder?: string
          tpl_due_reminder_en?: string
          tpl_irrigation_payment?: string
          tpl_irrigation_payment_en?: string
          tpl_loan_approved?: string
          tpl_loan_approved_en?: string
          tpl_loan_payment?: string
          tpl_loan_payment_en?: string
          tpl_qr_revoke?: string
          tpl_qr_revoke_en?: string
          tpl_qr_rotate?: string
          tpl_qr_rotate_en?: string
          tpl_savings_deposit?: string
          tpl_savings_deposit_en?: string
          tpl_savings_withdraw?: string
          tpl_savings_withdraw_en?: string
          updated_at?: string
        }
        Update: {
          api_key_set?: boolean
          config?: Json
          enabled?: boolean
          id?: number
          language?: string
          reminder_days_before?: number
          send_on_due_reminder?: boolean
          send_on_irrigation_payment?: boolean
          send_on_loan_approved?: boolean
          send_on_loan_payment?: boolean
          send_on_qr_revoke?: boolean
          send_on_qr_rotate?: boolean
          send_on_savings_deposit?: boolean
          send_on_savings_withdraw?: boolean
          sender_id?: string | null
          tpl_due_reminder?: string
          tpl_due_reminder_en?: string
          tpl_irrigation_payment?: string
          tpl_irrigation_payment_en?: string
          tpl_loan_approved?: string
          tpl_loan_approved_en?: string
          tpl_loan_payment?: string
          tpl_loan_payment_en?: string
          tpl_qr_revoke?: string
          tpl_qr_revoke_en?: string
          tpl_qr_rotate?: string
          tpl_qr_rotate_en?: string
          tpl_savings_deposit?: string
          tpl_savings_deposit_en?: string
          tpl_savings_withdraw?: string
          tpl_savings_withdraw_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          key: string
          name: string
          preferred_provider: string | null
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          name: string
          preferred_provider?: string | null
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          preferred_provider?: string | null
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      system_audit_logs: {
        Row: {
          action_type: string
          created_at: string
          id: string
          ip: string | null
          module: string
          new_data: Json | null
          office_id: string | null
          old_data: Json | null
          reference_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          ip?: string | null
          module: string
          new_data?: Json | null
          office_id?: string | null
          old_data?: Json | null
          reference_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          ip?: string | null
          module?: string
          new_data?: Json | null
          office_id?: string | null
          old_data?: Json | null
          reference_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      upazilas: {
        Row: {
          code: string | null
          created_at: string
          district_id: string | null
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          district_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          district_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upazilas_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
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
      voter_audit_logs: {
        Row: {
          account_number: string | null
          action: string | null
          changed_by: string | null
          created_at: string
          farmer_id: string
          id: string
          is_voter_new: boolean | null
          is_voter_old: boolean | null
          note: string | null
          office_id: string | null
          voter_number_new: string | null
          voter_number_old: string | null
        }
        Insert: {
          account_number?: string | null
          action?: string | null
          changed_by?: string | null
          created_at?: string
          farmer_id: string
          id?: string
          is_voter_new?: boolean | null
          is_voter_old?: boolean | null
          note?: string | null
          office_id?: string | null
          voter_number_new?: string | null
          voter_number_old?: string | null
        }
        Update: {
          account_number?: string | null
          action?: string | null
          changed_by?: string | null
          created_at?: string
          farmer_id?: string
          id?: string
          is_voter_new?: boolean | null
          is_voter_old?: boolean | null
          note?: string | null
          office_id?: string | null
          voter_number_new?: string | null
          voter_number_old?: string | null
        }
        Relationships: []
      }
      voucher_sequences: {
        Row: {
          fiscal_year: number
          last_no: number
          office_id: string
          voucher_type: string
        }
        Insert: {
          fiscal_year: number
          last_no?: number
          office_id: string
          voucher_type: string
        }
        Update: {
          fiscal_year?: number
          last_no?: number
          office_id?: string
          voucher_type?: string
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          amount: number
          attachment_mime: string | null
          attachment_path: string | null
          created_at: string
          created_by: string | null
          id: string
          narration: string | null
          office_id: string | null
          payee: string | null
          reference_id: string | null
          reference_type: string | null
          updated_at: string
          voucher_date: string
          voucher_no: string
          voucher_type: string
        }
        Insert: {
          amount?: number
          attachment_mime?: string | null
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          narration?: string | null
          office_id?: string | null
          payee?: string | null
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string
          voucher_date?: string
          voucher_no: string
          voucher_type: string
        }
        Update: {
          amount?: number
          attachment_mime?: string | null
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          narration?: string | null
          office_id?: string | null
          payee?: string | null
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string
          voucher_date?: string
          voucher_no?: string
          voucher_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      farmer_savings_balance: {
        Row: {
          balance: number | null
          farmer_id: string | null
          total_deposit: number | null
          total_withdraw: number | null
        }
        Relationships: []
      }
      lands_with_location: {
        Row: {
          created_at: string | null
          dag_no: string | null
          district_id: string | null
          district_name: string | null
          division_id: string | null
          division_name: string | null
          farmer_id: string | null
          field_type: Database["public"]["Enums"]["field_type"] | null
          id: string | null
          land_size: number | null
          mouza: string | null
          mouza_id: string | null
          mouza_name: string | null
          office_id: string | null
          owner_farmer_id: string | null
          owner_type: Database["public"]["Enums"]["owner_type"] | null
          patwari_id: string | null
          patwari_mobile: string | null
          patwari_name: string | null
          patwari_name_bn: string | null
          upazila_id: string | null
          upazila_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lands_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "lands_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lands_owner_farmer_id_fkey"
            columns: ["owner_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_savings_balance"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "lands_owner_farmer_id_fkey"
            columns: ["owner_farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lands_patwari_id_fkey"
            columns: ["patwari_id"]
            isOneToOne: false
            referencedRelation: "patwaris"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries_view: {
        Row: {
          account_code: string | null
          account_id: string | null
          account_name: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          created_at: string | null
          created_by: string | null
          credit: number | null
          debit: number | null
          description: string | null
          entry_date: string | null
          id: string | null
          office_id: string | null
          office_name: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _acct: { Args: { _code: string }; Returns: string }
      _clear_ref: {
        Args: { _ref_id: string; _ref_type: string }
        Returns: undefined
      }
      _lookup_email_by_username: {
        Args: { _username: string }
        Returns: string
      }
      _post_pair: {
        Args: {
          _amount: number
          _credit_acct: string
          _date: string
          _debit_acct: string
          _desc: string
          _office: string
          _ref_id: string
          _ref_type: string
          _user: string
        }
        Returns: undefined
      }
      _sms_format_bdt: { Args: { _n: number }; Returns: string }
      _sms_render: { Args: { _tpl: string; _vars: Json }; Returns: string }
      _sms_savings_balance: { Args: { _farmer: string }; Returns: number }
      activate_sms_token: { Args: { _id: string }; Returns: undefined }
      apply_loan_installment_penalties: { Args: never; Returns: Json }
      cancel_voter_membership: {
        Args: { _farmer_id: string; _reason: string }
        Returns: Json
      }
      close_accounting_period: {
        Args: { _from: string; _note?: string; _office?: string; _to: string }
        Returns: string
      }
      compute_penalty: {
        Args: { _base: number; _days_overdue: number }
        Returns: number
      }
      compute_period_summary: {
        Args: { _from: string; _office?: string; _to: string }
        Returns: {
          account_balances: Json
          cash_in: number
          cash_out: number
          net_income: number
          total_credit: number
          total_debit: number
          total_expense: number
          total_income: number
        }[]
      }
      current_user_office: { Args: never; Returns: string }
      data_integrity_scan: { Args: never; Returns: Json }
      email_for_username: { Args: { _username: string }; Returns: string }
      exec_sql_admin: { Args: { sql: string }; Returns: undefined }
      farmer_dues_breakdown: {
        Args: { _farmer_id: string }
        Returns: {
          farmer_id: string
          irrigation_due: number
          loan_due: number
          net_due: number
          savings_balance: number
          share_balance: number
        }[]
      }
      farmer_dues_summary: {
        Args: never
        Returns: {
          farmer_id: string
          irr_due: number
          loan_due: number
          net_due: number
          savings_bal: number
        }[]
      }
      farmer_identifier_exists: {
        Args: { _candidate: string; _exclude_id?: string }
        Returns: boolean
      }
      farmer_loan_statement: {
        Args: { _farmer_id: string; _from?: string; _to?: string }
        Returns: {
          balance: number
          credit: number
          debit: number
          description: string
          entry_date: string
          id: string
          reference_id: string
          reference_type: string
        }[]
      }
      farmer_savings_statement: {
        Args: { _farmer_id: string; _from?: string; _to?: string }
        Returns: {
          balance: number
          credit: number
          debit: number
          description: string
          entry_date: string
          id: string
          reference_id: string
          reference_type: string
        }[]
      }
      generate_account_number: {
        Args: { _office_id?: string }
        Returns: string
      }
      generate_farmer_account_number: {
        Args: { p_created_at: string; p_office_id: string }
        Returns: string
      }
      generate_farmer_qr_tokens: {
        Args: { _force_rotate?: boolean }
        Returns: Json
      }
      generate_farmer_voter_number: { Args: never; Returns: string }
      generate_invoice_no: { Args: never; Returns: string }
      generate_loan_installments: { Args: { _loan_id: string }; Returns: Json }
      generate_member_no: { Args: never; Returns: string }
      generate_receipt_no: {
        Args: { _office_id: string; _ts?: string }
        Returns: string
      }
      get_billed_farmer_for_land: {
        Args: { _as_of?: string; _land_id: string }
        Returns: {
          farmer_id: string
          is_borga: boolean
          owner_farmer_id: string
        }[]
      }
      get_previous_due: {
        Args: { _exclude_season: string; _farmer: string; _land: string }
        Returns: number
      }
      get_sms_provider_status: { Args: { _provider?: string }; Returns: Json }
      get_sms_provider_token: { Args: { _provider?: string }; Returns: string }
      has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
      is_committee_or_super: { Args: { _user_id: string }; Returns: boolean }
      is_date_in_closed_period: {
        Args: { _date: string; _office: string }
        Returns: boolean
      }
      is_developer: { Args: { _user_id: string }; Returns: boolean }
      is_developer_user: { Args: { _user_id: string }; Returns: boolean }
      ledger_integrity_summary: { Args: never; Returns: Json }
      ledger_orphan_refs: {
        Args: never
        Returns: {
          entry_count: number
          reference_id: string
          reference_type: string
        }[]
      }
      ledger_unbalanced_refs: {
        Args: never
        Returns: {
          diff: number
          reference_id: string
          reference_type: string
          total_credit: number
          total_debit: number
        }[]
      }
      list_collector_users: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          office_id: string
        }[]
      }
      log_developer_access: {
        Args: { _action: string; _blocked?: boolean; _meta?: Json }
        Returns: undefined
      }
      log_farmer_rejection: {
        Args: {
          _attempted: Json
          _error_message: string
          _failed_level: string
          _farmer_id: string
          _office_id: string
          _operation: string
          _reason: string
          _user_id: string
        }
        Returns: undefined
      }
      member_no_exists: {
        Args: { _exclude_id?: string; _member_no: string }
        Returns: boolean
      }
      next_monthly_receipt_no: {
        Args: { p_kind: string; p_office_id: string }
        Returns: string
      }
      next_receipt_no: { Args: { p_kind: string }; Returns: string }
      next_voucher_no: {
        Args: { _office: string; _type: string }
        Returns: string
      }
      normalize_farmer_identifier: { Args: { _value: string }; Returns: string }
      pg_public_table_columns: {
        Args: never
        Returns: {
          column_name: string
          data_type: string
          table_name: string
          udt_name: string
        }[]
      }
      pg_tables_public_list: {
        Args: never
        Returns: {
          tablename: string
        }[]
      }
      post_asset_depreciation_journal: {
        Args: { _schedule_id: string }
        Returns: string
      }
      reactivate_voter_membership: {
        Args: { _farmer_id: string; _reason: string }
        Returns: Json
      }
      recalculate_irrigation_invoice: {
        Args: { _invoice_id: string; _reason: string }
        Returns: {
          applied_rate: number | null
          calculation_snapshot: Json | null
          canal_amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          delay_fee: number
          deleted_at: string | null
          due_amount: number
          due_date: string
          farmer_id: string
          generated_at: string
          generated_by: string | null
          id: string
          invoice_no: string
          invoice_status: Database["public"]["Enums"]["invoice_status"]
          irrigation_amount: number
          irrigation_category_id: string | null
          irrigation_category_name: string | null
          is_borga: boolean
          is_manual_rate: boolean
          land_id: string
          land_type_id: string | null
          land_type_name: string | null
          maintenance_amount: number
          manual_rate_reason: string | null
          note: string | null
          office_id: string | null
          original_standard_rate: number | null
          other_charge: number
          override_reason: string | null
          owner_farmer_id: string
          paid_amount: number
          payable_amount: number
          rate_source: string | null
          recalculated_at: string | null
          recalculated_by: string | null
          season_id: string
          season_rate: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "irrigation_invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recompute_share_balance: {
        Args: { _farmer_id: string }
        Returns: undefined
      }
      reopen_accounting_period: { Args: { _id: string }; Returns: undefined }
      retire_sms_token: { Args: { _id: string }; Returns: undefined }
      run_monthly_depreciation_batch: {
        Args: { _period_month: string }
        Returns: {
          asset_id: string
          depreciation: number
          journal_entry_id: string
          message: string
          schedule_id: string
          status: string
        }[]
      }
      seed_rajshahi_locations: { Args: never; Returns: Json }
      sms_enqueue: {
        Args: {
          _event: string
          _farmer: string
          _message: string
          _mobile: string
          _office: string
          _ref_id: string
          _ref_type: string
        }
        Returns: string
      }
      validate_loan_installment_consistency: {
        Args: { _office?: string }
        Returns: {
          amount_mismatch: boolean
          approved_payments_total: number
          farmer_id: string
          installments_paid: number
          installments_total: number
          loan_id: string
          status_mismatch: boolean
          total_payable: number
        }[]
      }
      verify_seed_integrity: { Args: never; Returns: Json }
    }
    Enums: {
      account_type: "asset" | "liability" | "income" | "expense" | "equity"
      app_role: "super_admin" | "admin" | "staff" | "committee" | "developer"
      approval_status: "pending" | "approved" | "rejected"
      asset_depreciation_method: "straight_line" | "wdv"
      asset_depreciation_status: "pending" | "posted" | "skipped"
      asset_disposal_method: "scrap_sale" | "write_off" | "donation" | "lost"
      asset_status:
        | "purchased"
        | "in_stock"
        | "transferred"
        | "installed"
        | "maintenance"
        | "damaged"
        | "disposed"
        | "in_use"
        | "scrapped"
        | "lost"
      asset_tracking_mode: "quantity" | "serial"
      asset_type: "inventory" | "fixed_asset" | "consumable"
      field_type: "high_land" | "medium_land" | "low_land" | "other"
      installment_status: "due" | "paid" | "missed" | "partial"
      invoice_status:
        | "draft"
        | "generated"
        | "partial_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      irrigation_basis: "per_size" | "per_day" | "per_hour"
      loan_installment_type: "daily" | "weekly" | "monthly"
      loan_payment_status: "pending" | "approved" | "rejected"
      loan_penalty_type: "percentage" | "fixed"
      loan_status:
        | "pending"
        | "approved"
        | "paid"
        | "rejected"
        | "completed"
        | "overdue"
      owner_type: "owner" | "borgadar"
      payment_kind: "loan" | "savings" | "irrigation"
      payment_status: "pending" | "approved" | "rejected"
      receipt_kind:
        | "irrigation"
        | "bigha_rent"
        | "pond"
        | "crop_sale"
        | "scrap"
        | "loan_taken"
        | "donation"
        | "savings_deposit"
        | "share"
        | "other"
      savings_installment_type: "daily" | "monthly"
      savings_maturity_type: "simple" | "compound"
      savings_txn_type:
        | "deposit"
        | "withdraw"
        | "deposit_collection"
        | "share_collection"
        | "share_deposit"
        | "profit"
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
      account_type: ["asset", "liability", "income", "expense", "equity"],
      app_role: ["super_admin", "admin", "staff", "committee", "developer"],
      approval_status: ["pending", "approved", "rejected"],
      asset_depreciation_method: ["straight_line", "wdv"],
      asset_depreciation_status: ["pending", "posted", "skipped"],
      asset_disposal_method: ["scrap_sale", "write_off", "donation", "lost"],
      asset_status: [
        "purchased",
        "in_stock",
        "transferred",
        "installed",
        "maintenance",
        "damaged",
        "disposed",
        "in_use",
        "scrapped",
        "lost",
      ],
      asset_tracking_mode: ["quantity", "serial"],
      asset_type: ["inventory", "fixed_asset", "consumable"],
      field_type: ["high_land", "medium_land", "low_land", "other"],
      installment_status: ["due", "paid", "missed", "partial"],
      invoice_status: [
        "draft",
        "generated",
        "partial_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      irrigation_basis: ["per_size", "per_day", "per_hour"],
      loan_installment_type: ["daily", "weekly", "monthly"],
      loan_payment_status: ["pending", "approved", "rejected"],
      loan_penalty_type: ["percentage", "fixed"],
      loan_status: [
        "pending",
        "approved",
        "paid",
        "rejected",
        "completed",
        "overdue",
      ],
      owner_type: ["owner", "borgadar"],
      payment_kind: ["loan", "savings", "irrigation"],
      payment_status: ["pending", "approved", "rejected"],
      receipt_kind: [
        "irrigation",
        "bigha_rent",
        "pond",
        "crop_sale",
        "scrap",
        "loan_taken",
        "donation",
        "savings_deposit",
        "share",
        "other",
      ],
      savings_installment_type: ["daily", "monthly"],
      savings_maturity_type: ["simple", "compound"],
      savings_txn_type: [
        "deposit",
        "withdraw",
        "deposit_collection",
        "share_collection",
        "share_deposit",
        "profit",
      ],
      season_type: ["aman", "boro", "iri", "other"],
    },
  },
} as const
