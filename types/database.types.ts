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
    PostgrestVersion: "14.1"
  }
  media: {
    Tables: {
      action: {
        Row: {
          action_date: string
          action_id: number
          client_id: string
          created_at: string
          has_followup: boolean
          is_deleted: boolean
          memo: Json | null
          service_id: string | null
          stage: string | null
          updated_at: string
          widget_id: string | null
        }
        Insert: {
          action_date: string
          action_id?: number
          client_id: string
          created_at?: string
          has_followup?: boolean
          is_deleted?: boolean
          memo?: Json | null
          service_id?: string | null
          stage?: string | null
          updated_at?: string
          widget_id?: string | null
        }
        Update: {
          action_date?: string
          action_id?: number
          client_id?: string
          created_at?: string
          has_followup?: boolean
          is_deleted?: boolean
          memo?: Json | null
          service_id?: string | null
          stage?: string | null
          updated_at?: string
          widget_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "action_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "action_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widget"
            referencedColumns: ["widget_id"]
          },
        ]
      }
      client: {
        Row: {
          client_id: string
          client_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          is_active: boolean
          manager_id: number | null
          manager_id_second: number | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          client_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          is_active?: boolean
          manager_id?: number | null
          manager_id_second?: number | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          is_active?: boolean
          manager_id?: number | null
          manager_id_second?: number | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ref_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_manager_id_second_fkey"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "ref_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_rule: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          required_stages: string[]
          rule_day: number
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          required_stages?: string[]
          rule_day: number
          tier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          required_stages?: string[]
          rule_day?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      cvr: {
        Row: {
          campaign_count: number | null
          click: number | null
          client_id: string
          client_name: string | null
          contribution_margin_rate_pct: number | null
          cpc: number | null
          created_at: string
          date: string
          invalid_revenue_ratio_pct: number | null
          level: string | null
          normalized_cvr_pct: number | null
          revenue: number | null
          rpm: number | null
          service_id: string
          service_name: string | null
          service_type: string | null
          updated_at: string
          vctr_pct: number | null
          vimp: number | null
        }
        Insert: {
          campaign_count?: number | null
          click?: number | null
          client_id: string
          client_name?: string | null
          contribution_margin_rate_pct?: number | null
          cpc?: number | null
          created_at?: string
          date: string
          invalid_revenue_ratio_pct?: number | null
          level?: string | null
          normalized_cvr_pct?: number | null
          revenue?: number | null
          rpm?: number | null
          service_id: string
          service_name?: string | null
          service_type?: string | null
          updated_at?: string
          vctr_pct?: number | null
          vimp?: number | null
        }
        Update: {
          campaign_count?: number | null
          click?: number | null
          client_id?: string
          client_name?: string | null
          contribution_margin_rate_pct?: number | null
          cpc?: number | null
          created_at?: string
          date?: string
          invalid_revenue_ratio_pct?: number | null
          level?: string | null
          normalized_cvr_pct?: number | null
          revenue?: number | null
          rpm?: number | null
          service_id?: string
          service_name?: string | null
          service_type?: string | null
          updated_at?: string
          vctr_pct?: number | null
          vimp?: number | null
        }
        Relationships: []
      }
      daily: {
        Row: {
          client_id: string
          cnt_click: number
          cnt_cv: number
          cost_spent: number
          created_at: string
          date: string
          imp: number
          pub_profit: number
          service_id: string
          updated_at: string
          vimp: number
          widget_id: string
          widget_name: string | null
        }
        Insert: {
          client_id: string
          cnt_click?: number
          cnt_cv?: number
          cost_spent: number
          created_at?: string
          date: string
          imp?: number
          pub_profit: number
          service_id: string
          updated_at?: string
          vimp?: number
          widget_id: string
          widget_name?: string | null
        }
        Update: {
          client_id?: string
          cnt_click?: number
          cnt_cv?: number
          cost_spent?: number
          created_at?: string
          date?: string
          imp?: number
          pub_profit?: number
          service_id?: string
          updated_at?: string
          vimp?: number
          widget_id?: string
          widget_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "daily_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "daily_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widget"
            referencedColumns: ["widget_id"]
          },
        ]
      }
      daily_failed: {
        Row: {
          client_id: string | null
          cnt_click: number | null
          cnt_cv: number | null
          cost_spent: number | null
          created_at: string
          date: string | null
          error_message: string
          id: number
          imp: number | null
          pub_profit: number | null
          service_id: string | null
          vimp: number | null
          widget_id: string | null
          widget_name: string | null
        }
        Insert: {
          client_id?: string | null
          cnt_click?: number | null
          cnt_cv?: number | null
          cost_spent?: number | null
          created_at?: string
          date?: string | null
          error_message: string
          id?: number
          imp?: number | null
          pub_profit?: number | null
          service_id?: string | null
          vimp?: number | null
          widget_id?: string | null
          widget_name?: string | null
        }
        Update: {
          client_id?: string | null
          cnt_click?: number | null
          cnt_cv?: number | null
          cost_spent?: number | null
          created_at?: string
          date?: string | null
          error_message?: string
          id?: number
          imp?: number | null
          pub_profit?: number | null
          service_id?: string | null
          vimp?: number | null
          widget_id?: string | null
          widget_name?: string | null
        }
        Relationships: []
      }
      external_daily: {
        Row: {
          click: number | null
          date: string
          external_service_name: string
          external_widget_name: string
          fetched_at: string | null
          id: number
          imp: number | null
          revenue: number | null
          share_type: string | null
          source: string
        }
        Insert: {
          click?: number | null
          date: string
          external_service_name: string
          external_widget_name?: string
          fetched_at?: string | null
          id?: number
          imp?: number | null
          revenue?: number | null
          share_type?: string | null
          source: string
        }
        Update: {
          click?: number | null
          date?: string
          external_service_name?: string
          external_widget_name?: string
          fetched_at?: string | null
          id?: number
          imp?: number | null
          revenue?: number | null
          share_type?: string | null
          source?: string
        }
        Relationships: []
      }
      external_mapping: {
        Row: {
          created_at: string | null
          external_key: string
          id: number
          label: string | null
          source: string
          widget_id: string | null
        }
        Insert: {
          created_at?: string | null
          external_key: string
          id?: number
          label?: string | null
          source: string
          widget_id?: string | null
        }
        Update: {
          created_at?: string | null
          external_key?: string
          id?: number
          label?: string | null
          source?: string
          widget_id?: string | null
        }
        Relationships: []
      }
      external_value: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: number
          start_date: string
          value: Json
          widget_id: string
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: number
          start_date: string
          value?: Json
          widget_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: number
          start_date?: string
          value?: Json
          widget_id?: string
        }
        Relationships: []
      }
      goal: {
        Row: {
          created_at: string | null
          date_end: string
          date_start: string
          goal_type: string
          id: number
          manager_id: number | null
          memo: string | null
          updated_at: string | null
          vimp_target: number
        }
        Insert: {
          created_at?: string | null
          date_end: string
          date_start: string
          goal_type?: string
          id?: number
          manager_id?: number | null
          memo?: string | null
          updated_at?: string | null
          vimp_target?: number
        }
        Update: {
          created_at?: string | null
          date_end?: string
          date_start?: string
          goal_type?: string
          id?: number
          manager_id?: number | null
          memo?: string | null
          updated_at?: string | null
          vimp_target?: number
        }
        Relationships: []
      }
      service: {
        Row: {
          client_id: string
          competitor_etc: Json
          created_at: string
          has_competitor_taboola: boolean
          is_active: boolean
          service_id: string
          service_name: string
          service_type: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          competitor_etc?: Json
          created_at?: string
          has_competitor_taboola?: boolean
          is_active?: boolean
          service_id: string
          service_name: string
          service_type?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          competitor_etc?: Json
          created_at?: string
          has_competitor_taboola?: boolean
          is_active?: boolean
          service_id?: string
          service_name?: string
          service_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
        ]
      }
      widget: {
        Row: {
          client_id: string
          created_at: string
          service_id: string
          updated_at: string
          widget_id: string
          widget_name: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          service_id: string
          updated_at?: string
          widget_id: string
          widget_name?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          service_id?: string
          updated_at?: string
          widget_id?: string
          widget_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "widget_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["service_id"]
          },
        ]
      }
      widget_contract: {
        Row: {
          client_id: string
          contract_type: string | null
          contract_value: number | null
          created_at: string
          date_end: string | null
          date_start: string | null
          id: number
          service_id: string
          updated_at: string
          widget_id: string
        }
        Insert: {
          client_id: string
          contract_type?: string | null
          contract_value?: number | null
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          id?: number
          service_id: string
          updated_at?: string
          widget_id: string
        }
        Update: {
          client_id?: string
          contract_type?: string | null
          contract_value?: number | null
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          id?: number
          service_id?: string
          updated_at?: string
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_contract_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "widget_contract_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "widget_contract_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widget"
            referencedColumns: ["widget_id"]
          },
        ]
      }
    }
    Views: {
      ref_holiday: {
        Row: {
          created_at: string | null
          holiday_name: string | null
          id: string | null
        }
        Insert: {
          created_at?: string | null
          holiday_name?: string | null
          id?: string | null
        }
        Update: {
          created_at?: string | null
          holiday_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
      ref_manager: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: number | null
          name: string | null
          team: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: number | null
          name?: string | null
          team?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: number | null
          name?: string | null
          team?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ref_week: {
        Row: {
          created_at: string | null
          date_end: string | null
          date_start: string | null
          display_label: string | null
          id: number | null
          updated_at: string | null
          week_number: number | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          date_end?: string | null
          date_start?: string | null
          display_label?: string | null
          id?: number | null
          updated_at?: string | null
          week_number?: number | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          date_end?: string | null
          date_start?: string | null
          display_label?: string | null
          id?: number | null
          updated_at?: string | null
          week_number?: number | null
          year?: number | null
        }
        Relationships: []
      }
      v_daily: {
        Row: {
          ad_revenue: number | null
          client_id: string | null
          client_name: string | null
          cnt_click: number | null
          cost_spent: number | null
          date: string | null
          imp: number | null
          service_id: string | null
          service_name: string | null
          vimp: number | null
          widget_id: string | null
          widget_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "daily_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "daily_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widget"
            referencedColumns: ["widget_id"]
          },
        ]
      }
      v_daily_by_service: {
        Row: {
          ad_revenue: number | null
          client_id: string | null
          client_name: string | null
          cnt_click: number | null
          cost_spent: number | null
          date: string | null
          imp: number | null
          service_id: string | null
          service_name: string | null
          vimp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "daily_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["service_id"]
          },
        ]
      }
      v_daily_total: {
        Row: {
          ad_revenue: number | null
          cnt_click: number | null
          cost_spent: number | null
          date: string | null
          imp: number | null
          vimp: number | null
        }
        Relationships: []
      }
      v_dates: {
        Row: {
          date: string | null
        }
        Relationships: []
      }
      v_monthly: {
        Row: {
          ad_revenue: number | null
          client_id: string | null
          client_name: string | null
          cnt_click: number | null
          cost_spent: number | null
          imp: number | null
          service_id: string | null
          service_name: string | null
          vimp: number | null
          widget_id: string | null
          widget_name: string | null
          year_month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "daily_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "daily_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widget"
            referencedColumns: ["widget_id"]
          },
        ]
      }
      v_monthly_periods: {
        Row: {
          year_month: string | null
        }
        Relationships: []
      }
      v_weekly: {
        Row: {
          ad_revenue: number | null
          client_id: string | null
          client_name: string | null
          cnt_click: number | null
          cost_spent: number | null
          date_end: string | null
          date_start: string | null
          display_label: string | null
          imp: number | null
          service_id: string | null
          service_name: string | null
          vimp: number | null
          week_number: number | null
          widget_id: string | null
          widget_name: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "daily_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "daily_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widget"
            referencedColumns: ["widget_id"]
          },
        ]
      }
      v_weekly_periods: {
        Row: {
          display_label: string | null
          week_number: number | null
          year: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      refresh_daily_views: { Args: never; Returns: undefined }
      rename_client_id: {
        Args: { p_new_id: string; p_old_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  shared: {
    Tables: {
      holiday: {
        Row: {
          created_at: string | null
          holiday_name: string
          id: string
        }
        Insert: {
          created_at?: string | null
          holiday_name: string
          id: string
        }
        Update: {
          created_at?: string | null
          holiday_name?: string
          id?: string
        }
        Relationships: []
      }
      manager: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: number
          name: string
          team: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: number
          name: string
          team: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: number
          name?: string
          team?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      week: {
        Row: {
          created_at: string | null
          date_end: string
          date_start: string
          display_label: string
          id: number
          updated_at: string | null
          week_number: number
          year: number
        }
        Insert: {
          created_at?: string | null
          date_end: string
          date_start: string
          display_label: string
          id: number
          updated_at?: string | null
          week_number: number
          year: number
        }
        Update: {
          created_at?: string | null
          date_end?: string
          date_start?: string
          display_label?: string
          id?: number
          updated_at?: string | null
          week_number?: number
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  media: {
    Enums: {},
  },
  shared: {
    Enums: {},
  },
} as const
