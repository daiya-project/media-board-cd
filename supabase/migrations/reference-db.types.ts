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
  public: {
    Tables: {
      ads_crm_action: {
        Row: {
          action_date: string
          action_type: Database["public"]["Enums"]["ads_crm_action_type"]
          budget_from: number | null
          budget_to: number | null
          created_at: string | null
          created_by: number | null
          id: number
          memo: string | null
          pipeline_id: number
          product: Database["public"]["Enums"]["ads_crm_product"]
          stage_from: Database["public"]["Enums"]["ads_crm_stage"] | null
          stage_to: Database["public"]["Enums"]["ads_crm_stage"] | null
        }
        Insert: {
          action_date?: string
          action_type: Database["public"]["Enums"]["ads_crm_action_type"]
          budget_from?: number | null
          budget_to?: number | null
          created_at?: string | null
          created_by?: number | null
          id: number
          memo?: string | null
          pipeline_id: number
          product: Database["public"]["Enums"]["ads_crm_product"]
          stage_from?: Database["public"]["Enums"]["ads_crm_stage"] | null
          stage_to?: Database["public"]["Enums"]["ads_crm_stage"] | null
        }
        Update: {
          action_date?: string
          action_type?: Database["public"]["Enums"]["ads_crm_action_type"]
          budget_from?: number | null
          budget_to?: number | null
          created_at?: string | null
          created_by?: number | null
          id?: number
          memo?: string | null
          pipeline_id?: number
          product?: Database["public"]["Enums"]["ads_crm_product"]
          stage_from?: Database["public"]["Enums"]["ads_crm_stage"] | null
          stage_to?: Database["public"]["Enums"]["ads_crm_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_crm_action_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_action_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_action_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_crm_action_pipeline_id_product_fkey"
            columns: ["pipeline_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline"
            referencedColumns: ["id", "product"]
          },
          {
            foreignKeyName: "ads_crm_action_pipeline_id_product_fkey"
            columns: ["pipeline_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["id", "product"]
          },
        ]
      }
      ads_crm_client: {
        Row: {
          client_name: string
          client_type: Database["public"]["Enums"]["ads_crm_client_type"]
          created_at: string | null
          id: number
          product: Database["public"]["Enums"]["ads_crm_product"]
          updated_at: string | null
        }
        Insert: {
          client_name: string
          client_type: Database["public"]["Enums"]["ads_crm_client_type"]
          created_at?: string | null
          id: number
          product: Database["public"]["Enums"]["ads_crm_product"]
          updated_at?: string | null
        }
        Update: {
          client_name?: string
          client_type?: Database["public"]["Enums"]["ads_crm_client_type"]
          created_at?: string | null
          id?: number
          product?: Database["public"]["Enums"]["ads_crm_product"]
          updated_at?: string | null
        }
        Relationships: []
      }
      ads_crm_contact: {
        Row: {
          client_id: number
          created_at: string | null
          email: string | null
          id: number
          name: string
          note: string | null
          phone: string | null
          product: Database["public"]["Enums"]["ads_crm_product"]
          updated_at: string | null
        }
        Insert: {
          client_id: number
          created_at?: string | null
          email?: string | null
          id: number
          name: string
          note?: string | null
          phone?: string | null
          product: Database["public"]["Enums"]["ads_crm_product"]
          updated_at?: string | null
        }
        Update: {
          client_id?: number
          created_at?: string | null
          email?: string | null
          id?: number
          name?: string
          note?: string | null
          phone?: string | null
          product?: Database["public"]["Enums"]["ads_crm_product"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_crm_contact_client_id_product_fkey"
            columns: ["client_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_client"
            referencedColumns: ["id", "product"]
          },
          {
            foreignKeyName: "ads_crm_contact_client_id_product_fkey"
            columns: ["client_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_client_summary"
            referencedColumns: ["client_id", "product"]
          },
        ]
      }
      ads_crm_followup: {
        Row: {
          action_id: number
          completed_at: string | null
          completed_by: number | null
          created_at: string | null
          created_by: number | null
          due_date: string
          id: number
          is_completed: boolean | null
          note: string | null
          product: Database["public"]["Enums"]["ads_crm_product"]
          updated_at: string | null
        }
        Insert: {
          action_id: number
          completed_at?: string | null
          completed_by?: number | null
          created_at?: string | null
          created_by?: number | null
          due_date: string
          id: number
          is_completed?: boolean | null
          note?: string | null
          product: Database["public"]["Enums"]["ads_crm_product"]
          updated_at?: string | null
        }
        Update: {
          action_id?: number
          completed_at?: string | null
          completed_by?: number | null
          created_at?: string | null
          created_by?: number | null
          due_date?: string
          id?: number
          is_completed?: boolean | null
          note?: string | null
          product?: Database["public"]["Enums"]["ads_crm_product"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_crm_followup_action_id_product_fkey"
            columns: ["action_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_action"
            referencedColumns: ["id", "product"]
          },
          {
            foreignKeyName: "ads_crm_followup_action_id_product_fkey"
            columns: ["action_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_action_detail"
            referencedColumns: ["id", "product"]
          },
          {
            foreignKeyName: "ads_crm_followup_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_followup_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_followup_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_crm_followup_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_followup_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_followup_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_crm_note: {
        Row: {
          action_id: number
          content: string
          created_at: string | null
          created_by: number | null
          id: number
          product: Database["public"]["Enums"]["ads_crm_product"]
          updated_at: string | null
        }
        Insert: {
          action_id: number
          content: string
          created_at?: string | null
          created_by?: number | null
          id: number
          product: Database["public"]["Enums"]["ads_crm_product"]
          updated_at?: string | null
        }
        Update: {
          action_id?: number
          content?: string
          created_at?: string | null
          created_by?: number | null
          id?: number
          product?: Database["public"]["Enums"]["ads_crm_product"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_crm_note_action_id_product_fkey"
            columns: ["action_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_action"
            referencedColumns: ["id", "product"]
          },
          {
            foreignKeyName: "ads_crm_note_action_id_product_fkey"
            columns: ["action_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_action_detail"
            referencedColumns: ["id", "product"]
          },
          {
            foreignKeyName: "ads_crm_note_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_note_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_note_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_crm_pipeline: {
        Row: {
          actual_close_date: string | null
          campaign: string | null
          client_id: number
          contact_id: number | null
          created_at: string | null
          current_budget: number | null
          current_stage: Database["public"]["Enums"]["ads_crm_stage"]
          expected_close_date: string | null
          id: number
          manager_id: number | null
          product: Database["public"]["Enums"]["ads_crm_product"]
          updated_at: string | null
        }
        Insert: {
          actual_close_date?: string | null
          campaign?: string | null
          client_id: number
          contact_id?: number | null
          created_at?: string | null
          current_budget?: number | null
          current_stage?: Database["public"]["Enums"]["ads_crm_stage"]
          expected_close_date?: string | null
          id: number
          manager_id?: number | null
          product: Database["public"]["Enums"]["ads_crm_product"]
          updated_at?: string | null
        }
        Update: {
          actual_close_date?: string | null
          campaign?: string | null
          client_id?: number
          contact_id?: number | null
          created_at?: string | null
          current_budget?: number | null
          current_stage?: Database["public"]["Enums"]["ads_crm_stage"]
          expected_close_date?: string | null
          id?: number
          manager_id?: number | null
          product?: Database["public"]["Enums"]["ads_crm_product"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_crm_pipeline_client_id_product_fkey"
            columns: ["client_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_client"
            referencedColumns: ["id", "product"]
          },
          {
            foreignKeyName: "ads_crm_pipeline_client_id_product_fkey"
            columns: ["client_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_client_summary"
            referencedColumns: ["client_id", "product"]
          },
          {
            foreignKeyName: "ads_crm_pipeline_contact_id_product_fkey"
            columns: ["contact_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_contact"
            referencedColumns: ["id", "product"]
          },
          {
            foreignKeyName: "ads_crm_pipeline_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_pipeline_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_pipeline_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_client: {
        Row: {
          client_id: string
          client_name: string
          created_at: string | null
          manager_id: number | null
          outbound: boolean
          second_manager_id: number | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          client_name: string
          created_at?: string | null
          manager_id?: number | null
          outbound?: boolean
          second_manager_id?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          client_name?: string
          created_at?: string | null
          manager_id?: number | null
          outbound?: boolean
          second_manager_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ads_data_client_second_manager"
            columns: ["second_manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_ads_data_client_second_manager"
            columns: ["second_manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_ads_data_client_second_manager"
            columns: ["second_manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_client_outbound: {
        Row: {
          client_id: string
          created_at: string | null
          id: number
          outbound_end: string
          outbound_start: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: number
          outbound_end: string
          outbound_start: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: number
          outbound_end?: string
          outbound_start?: string
        }
        Relationships: []
      }
      ads_data_daily: {
        Row: {
          amount: number
          click: number | null
          client_id: string
          client_name: string | null
          conversion: number | null
          created_at: string | null
          date: string
          id: string
          is_holiday: boolean | null
          manager_id: number | null
          updated_at: string | null
          vimp: number | null
        }
        Insert: {
          amount?: number
          click?: number | null
          client_id: string
          client_name?: string | null
          conversion?: number | null
          created_at?: string | null
          date: string
          id?: string
          is_holiday?: boolean | null
          manager_id?: number | null
          updated_at?: string | null
          vimp?: number | null
        }
        Update: {
          amount?: number
          click?: number | null
          client_id?: string
          client_name?: string | null
          conversion?: number | null
          created_at?: string | null
          date?: string
          id?: string
          is_holiday?: boolean | null
          manager_id?: number | null
          updated_at?: string | null
          vimp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_goal: {
        Row: {
          activate: boolean
          created_at: string | null
          end_date: string | null
          goal_category: string | null
          goal_revenue: number
          id: string
          manager_id: number | null
          memo: string | null
          period_type: string | null
          start_date: string
          start_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          activate?: boolean
          created_at?: string | null
          end_date?: string | null
          goal_category?: string | null
          goal_revenue?: number
          id?: string
          manager_id?: number | null
          memo?: string | null
          period_type?: string | null
          start_date: string
          start_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          activate?: boolean
          created_at?: string | null
          end_date?: string | null
          goal_category?: string | null
          goal_revenue?: number
          id?: string
          manager_id?: number | null
          memo?: string | null
          period_type?: string | null
          start_date?: string
          start_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_board_goal_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_goal_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_goal_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_goal_actionitem: {
        Row: {
          action_item: string
          created_at: string | null
          done_memo: string | null
          goal_id: string
          id: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          action_item: string
          created_at?: string | null
          done_memo?: string | null
          goal_id: string
          id?: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          action_item?: string
          created_at?: string | null
          done_memo?: string | null
          goal_id?: string
          id?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_data_goal_actionitem_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "ads_data_goal"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_goal_targetclient: {
        Row: {
          client_id: string
          created_at: string | null
          goal_id: string
          id: number
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          goal_id: string
          id?: number
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          goal_id?: string
          id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_data_goal_targetclient_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ads_data_client"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_data_goal_targetclient_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ads_data_v_ma_cpc"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_data_goal_targetclient_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ads_data_v_ma_cvr"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_data_goal_targetclient_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ads_data_v_ma_revenue"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_data_goal_targetclient_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ads_data_v_ma_vctr"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_data_goal_targetclient_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "ads_data_v_outbound"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "ads_data_goal_targetclient_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "ads_data_goal"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_actions: {
        Row: {
          action_date: string
          action_followup: boolean
          action_type: string
          budget: number | null
          created_at: string
          id: number
          memo: string | null
          pipeline_id: string
          stage: string | null
          updated_at: string | null
        }
        Insert: {
          action_date?: string
          action_followup?: boolean
          action_type: string
          budget?: number | null
          created_at?: string
          id?: number
          memo?: string | null
          pipeline_id: string
          stage?: string | null
          updated_at?: string | null
        }
        Update: {
          action_date?: string
          action_followup?: boolean
          action_type?: string
          budget?: number | null
          created_at?: string
          id?: number
          memo?: string | null
          pipeline_id?: string
          stage?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pipeline_id"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_client_pipeline"
            referencedColumns: ["unique_id"]
          },
          {
            foreignKeyName: "fk_pipeline_id"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_current_state"
            referencedColumns: ["unique_id"]
          },
        ]
      }
      crm_client_pipeline: {
        Row: {
          campaign: string | null
          client_id: number | null
          client_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          manager_id: number | null
          pipeline_followup: boolean
          product: string | null
          unique_id: string
          updated_at: string | null
        }
        Insert: {
          campaign?: string | null
          client_id?: number | null
          client_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          manager_id?: number | null
          pipeline_followup?: boolean
          product?: string | null
          unique_id: string
          updated_at?: string | null
        }
        Update: {
          campaign?: string | null
          client_id?: number | null
          client_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          manager_id?: number | null
          pipeline_followup?: boolean
          product?: string | null
          unique_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_manager_id"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_manager_id"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_manager_id"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      media_crm_actions: {
        Row: {
          action_date: string
          action_followup: boolean | null
          action_id: number
          created_at: string | null
          media_id: number
          memo: string | null
          service_id: number | null
          stage: string | null
          updated_at: string | null
          widget_id: string | null
        }
        Insert: {
          action_date: string
          action_followup?: boolean | null
          action_id?: number
          created_at?: string | null
          media_id: number
          memo?: string | null
          service_id?: number | null
          stage?: string | null
          updated_at?: string | null
          widget_id?: string | null
        }
        Update: {
          action_date?: string
          action_followup?: boolean | null
          action_id?: number
          created_at?: string | null
          media_id?: number
          memo?: string | null
          service_id?: number | null
          stage?: string | null
          updated_at?: string | null
          widget_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_action_media"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_crm_media"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "fk_action_service"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "media_crm_service"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "fk_action_widget"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "media_crm_widget"
            referencedColumns: ["widget_id"]
          },
        ]
      }
      media_crm_cvr: {
        Row: {
          campaign: number | null
          client: string | null
          cmr: number | null
          cost_spent: number | null
          cpc: number | null
          created_at: string | null
          cvr: number | null
          invalid_rate: number | null
          level: string | null
          month: string
          rpm: number | null
          servce: string
          service_type: string | null
          updated_at: string | null
          vctr: number | null
          vimp: number | null
        }
        Insert: {
          campaign?: number | null
          client?: string | null
          cmr?: number | null
          cost_spent?: number | null
          cpc?: number | null
          created_at?: string | null
          cvr?: number | null
          invalid_rate?: number | null
          level?: string | null
          month: string
          rpm?: number | null
          servce: string
          service_type?: string | null
          updated_at?: string | null
          vctr?: number | null
          vimp?: number | null
        }
        Update: {
          campaign?: number | null
          client?: string | null
          cmr?: number | null
          cost_spent?: number | null
          cpc?: number | null
          created_at?: string | null
          cvr?: number | null
          invalid_rate?: number | null
          level?: string | null
          month?: string
          rpm?: number | null
          servce?: string
          service_type?: string | null
          updated_at?: string | null
          vctr?: number | null
          vimp?: number | null
        }
        Relationships: []
      }
      media_crm_data: {
        Row: {
          click: number | null
          cost_spent: number | null
          created_at: string | null
          date: string
          imp: number | null
          media_id: number
          pub_profit: number | null
          service_cv: number | null
          service_id: number
          updated_at: string | null
          vimp: number | null
          widget_id: string
          widget_name: string | null
        }
        Insert: {
          click?: number | null
          cost_spent?: number | null
          created_at?: string | null
          date: string
          imp?: number | null
          media_id: number
          pub_profit?: number | null
          service_cv?: number | null
          service_id: number
          updated_at?: string | null
          vimp?: number | null
          widget_id: string
          widget_name?: string | null
        }
        Update: {
          click?: number | null
          cost_spent?: number | null
          created_at?: string | null
          date?: string
          imp?: number | null
          media_id?: number
          pub_profit?: number | null
          service_cv?: number | null
          service_id?: number
          updated_at?: string | null
          vimp?: number | null
          widget_id?: string
          widget_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_data_media"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_crm_media"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "fk_data_service"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "media_crm_service"
            referencedColumns: ["service_id"]
          },
        ]
      }
      media_crm_data_failed: {
        Row: {
          click: number | null
          cost_spent: number | null
          created_at: string | null
          date: string | null
          error_message: string | null
          id: number
          imp: number | null
          import_attempt_at: string | null
          media_id: number | null
          pub_profit: number | null
          resolved: boolean | null
          resolved_at: string | null
          service_cv: number | null
          service_id: number | null
          vimp: number | null
          widget_id: string | null
          widget_name: string | null
        }
        Insert: {
          click?: number | null
          cost_spent?: number | null
          created_at?: string | null
          date?: string | null
          error_message?: string | null
          id?: number
          imp?: number | null
          import_attempt_at?: string | null
          media_id?: number | null
          pub_profit?: number | null
          resolved?: boolean | null
          resolved_at?: string | null
          service_cv?: number | null
          service_id?: number | null
          vimp?: number | null
          widget_id?: string | null
          widget_name?: string | null
        }
        Update: {
          click?: number | null
          cost_spent?: number | null
          created_at?: string | null
          date?: string | null
          error_message?: string | null
          id?: number
          imp?: number | null
          import_attempt_at?: string | null
          media_id?: number | null
          pub_profit?: number | null
          resolved?: boolean | null
          resolved_at?: string | null
          service_cv?: number | null
          service_id?: number | null
          vimp?: number | null
          widget_id?: string | null
          widget_name?: string | null
        }
        Relationships: []
      }
      media_crm_import_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          data_date_end: string | null
          data_date_start: string | null
          error_message: string | null
          failed_rows: number | null
          id: number
          imported_rows: number | null
          skipped_rows: number | null
          started_at: string
          status: string | null
          total_rows: number | null
          widgets_created: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          data_date_end?: string | null
          data_date_start?: string | null
          error_message?: string | null
          failed_rows?: number | null
          id?: number
          imported_rows?: number | null
          skipped_rows?: number | null
          started_at: string
          status?: string | null
          total_rows?: number | null
          widgets_created?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          data_date_end?: string | null
          data_date_start?: string | null
          error_message?: string | null
          failed_rows?: number | null
          id?: number
          imported_rows?: number | null
          skipped_rows?: number | null
          started_at?: string
          status?: string | null
          total_rows?: number | null
          widgets_created?: number | null
        }
        Relationships: []
      }
      media_crm_media: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          manager_id: number | null
          manager_id_second: number | null
          media_id: number
          media_name: string
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          manager_id?: number | null
          manager_id_second?: number | null
          media_id: number
          media_name: string
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          manager_id?: number | null
          manager_id_second?: number | null
          media_id?: number
          media_name?: string
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      media_crm_service: {
        Row: {
          competitor_etc: string | null
          competitor_taboola: boolean | null
          created_at: string | null
          media_id: number
          service_id: number
          service_name: string
          service_type: string | null
          updated_at: string | null
        }
        Insert: {
          competitor_etc?: string | null
          competitor_taboola?: boolean | null
          created_at?: string | null
          media_id: number
          service_id: number
          service_name: string
          service_type?: string | null
          updated_at?: string | null
        }
        Update: {
          competitor_etc?: string | null
          competitor_taboola?: boolean | null
          created_at?: string | null
          media_id?: number
          service_id?: number
          service_name?: string
          service_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_service_media"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_crm_media"
            referencedColumns: ["media_id"]
          },
        ]
      }
      media_crm_widget: {
        Row: {
          created_at: string | null
          media_id: number
          service_id: number
          updated_at: string | null
          widget_id: string
          widget_name: string | null
        }
        Insert: {
          created_at?: string | null
          media_id: number
          service_id: number
          updated_at?: string | null
          widget_id: string
          widget_name?: string | null
        }
        Update: {
          created_at?: string | null
          media_id?: number
          service_id?: number
          updated_at?: string | null
          widget_id?: string
          widget_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_widget_service"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "media_crm_service"
            referencedColumns: ["service_id"]
          },
        ]
      }
      media_crm_widget_contract: {
        Row: {
          contract_type: string | null
          contract_value: number | null
          created_at: string | null
          end_date: string | null
          media_id: number
          service_id: number
          start_date: string | null
          terms: string | null
          updated_at: string | null
          widget_id: string
        }
        Insert: {
          contract_type?: string | null
          contract_value?: number | null
          created_at?: string | null
          end_date?: string | null
          media_id: number
          service_id: number
          start_date?: string | null
          terms?: string | null
          updated_at?: string | null
          widget_id: string
        }
        Update: {
          contract_type?: string | null
          contract_value?: number | null
          created_at?: string | null
          end_date?: string | null
          media_id?: number
          service_id?: number
          start_date?: string | null
          terms?: string | null
          updated_at?: string | null
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_contract_media"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_crm_media"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "fk_contract_service"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "media_crm_service"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "fk_contract_widget"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "media_crm_widget"
            referencedColumns: ["widget_id"]
          },
        ]
      }
      shared_holiday: {
        Row: {
          created_at: string | null
          holiday_date: string
          holiday_name: string
          id: string
          is_lunar: boolean | null
        }
        Insert: {
          created_at?: string | null
          holiday_date: string
          holiday_name: string
          id?: string
          is_lunar?: boolean | null
        }
        Update: {
          created_at?: string | null
          holiday_date?: string
          holiday_name?: string
          id?: string
          is_lunar?: boolean | null
        }
        Relationships: []
      }
      shared_manager: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: number
          manager_name: string
          manager_team: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id: number
          manager_name: string
          manager_team?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: number
          manager_name?: string
          manager_team?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shared_week: {
        Row: {
          created_at: string | null
          end_date: string
          start_date: string
          updated_at: string | null
          week_id: string
          week_label: string | null
          week_number: number
          year: number
        }
        Insert: {
          created_at?: string | null
          end_date: string
          start_date: string
          updated_at?: string | null
          week_id: string
          week_label?: string | null
          week_number: number
          year: number
        }
        Update: {
          created_at?: string | null
          end_date?: string
          start_date?: string
          updated_at?: string | null
          week_id?: string
          week_label?: string | null
          week_number?: number
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      ads_crm_action_detail: {
        Row: {
          action_date: string | null
          action_type: Database["public"]["Enums"]["ads_crm_action_type"] | null
          budget_from: number | null
          budget_to: number | null
          campaign: string | null
          client_name: string | null
          created_at: string | null
          created_by_name: string | null
          followup_count: number | null
          id: number | null
          memo: string | null
          note_count: number | null
          pending_followups: number | null
          pipeline_id: number | null
          product: Database["public"]["Enums"]["ads_crm_product"] | null
          stage_from: Database["public"]["Enums"]["ads_crm_stage"] | null
          stage_to: Database["public"]["Enums"]["ads_crm_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_crm_action_pipeline_id_product_fkey"
            columns: ["pipeline_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline"
            referencedColumns: ["id", "product"]
          },
          {
            foreignKeyName: "ads_crm_action_pipeline_id_product_fkey"
            columns: ["pipeline_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["id", "product"]
          },
        ]
      }
      ads_crm_client_summary: {
        Row: {
          action_count: number | null
          client_id: number | null
          client_name: string | null
          client_type: Database["public"]["Enums"]["ads_crm_client_type"] | null
          contact_email: string | null
          contact_id: number | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          current_budget: number | null
          last_action_date: string | null
          last_action_id: number | null
          last_action_type:
            | Database["public"]["Enums"]["ads_crm_action_type"]
            | null
          last_memo: string | null
          last_stage: Database["public"]["Enums"]["ads_crm_stage"] | null
          manager_id: number | null
          manager_name: string | null
          next_followup_date: string | null
          pending_followups: number | null
          product: Database["public"]["Enums"]["ads_crm_product"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_crm_pipeline_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_pipeline_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_crm_pipeline_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_crm_dashboard_stat: {
        Row: {
          active_budget: number | null
          active_pipelines: number | null
          product: Database["public"]["Enums"]["ads_crm_product"] | null
          stage_contact: number | null
          stage_lost: number | null
          stage_negotiation: number | null
          stage_proposed: number | null
          stage_won: number | null
          total_budget: number | null
          total_pipelines: number | null
          win_rate: number | null
          won_budget: number | null
        }
        Relationships: []
      }
      ads_crm_pipeline_summary: {
        Row: {
          action_count: number | null
          actual_close_date: string | null
          campaign: string | null
          client_id: number | null
          client_name: string | null
          client_type: Database["public"]["Enums"]["ads_crm_client_type"] | null
          contact_email: string | null
          contact_id: number | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          current_budget: number | null
          current_stage: Database["public"]["Enums"]["ads_crm_stage"] | null
          expected_close_date: string | null
          id: number | null
          last_action_date: string | null
          last_action_id: number | null
          last_action_type:
            | Database["public"]["Enums"]["ads_crm_action_type"]
            | null
          last_memo: string | null
          manager_id: number | null
          manager_name: string | null
          next_followup_date: string | null
          pending_followups: number | null
          product: Database["public"]["Enums"]["ads_crm_product"] | null
          updated_at: string | null
        }
        Relationships: []
      }
      ads_crm_today_followup: {
        Row: {
          action_date: string | null
          action_id: number | null
          action_memo: string | null
          action_type: Database["public"]["Enums"]["ads_crm_action_type"] | null
          campaign: string | null
          client_name: string | null
          client_type: Database["public"]["Enums"]["ads_crm_client_type"] | null
          created_at: string | null
          current_stage: Database["public"]["Enums"]["ads_crm_stage"] | null
          due_date: string | null
          id: number | null
          is_completed: boolean | null
          manager_id: number | null
          manager_name: string | null
          note: string | null
          pipeline_id: number | null
          product: Database["public"]["Enums"]["ads_crm_product"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_crm_followup_action_id_product_fkey"
            columns: ["action_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_action"
            referencedColumns: ["id", "product"]
          },
          {
            foreignKeyName: "ads_crm_followup_action_id_product_fkey"
            columns: ["action_id", "product"]
            isOneToOne: false
            referencedRelation: "ads_crm_action_detail"
            referencedColumns: ["id", "product"]
          },
        ]
      }
      ads_data_v_daily_summary: {
        Row: {
          client_count: number | null
          daily_amount: number | null
          date: string | null
          is_holiday: boolean | null
          is_weekend: boolean | null
          manager_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_v_ma_cpc: {
        Row: {
          client_id: string | null
          cpc: number | null
          date: string | null
          gap_pct_cpc: number | null
          manager_id: number | null
          moving_avg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_v_ma_cvr: {
        Row: {
          client_id: string | null
          cvr: number | null
          date: string | null
          gap_pct_cvr: number | null
          manager_id: number | null
          moving_avg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_v_ma_revenue: {
        Row: {
          amount: number | null
          client_id: string | null
          date: string | null
          gap_pct_revenue: number | null
          manager_id: number | null
          moving_avg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_v_ma_vctr: {
        Row: {
          client_id: string | null
          date: string | null
          gap_pct_vctr: number | null
          manager_id: number | null
          moving_avg: number | null
          vctr: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_v_monthly_cumulative: {
        Row: {
          cumulative_amount: number | null
          daily_total: number | null
          date: string | null
          day: number | null
          is_holiday: boolean | null
          is_weekend: boolean | null
          manager_id: number | null
          month: number | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_v_outbound: {
        Row: {
          amount: number | null
          client_id: string | null
          client_name: string | null
          date: string | null
          manager_id: number | null
          outbound_end: string | null
          outbound_start: string | null
          second_manager_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_client_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ads_data_client_second_manager"
            columns: ["second_manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_ads_data_client_second_manager"
            columns: ["second_manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_ads_data_client_second_manager"
            columns: ["second_manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_data_v_weekly: {
        Row: {
          client_id: string | null
          client_name: string | null
          day_count: number | null
          manager_id: number | null
          total_records: number | null
          week_end: string | null
          week_number: number | null
          week_start: string | null
          weekly_amount: number | null
          year: number | null
        }
        Relationships: []
      }
      ads_data_v_weekly_progress: {
        Row: {
          client_count: number | null
          data_day_count: number | null
          manager_id: number | null
          week_achieved: number | null
          week_end: string | null
          week_id: string | null
          week_label: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "ads_board_daily_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_current_state: {
        Row: {
          action_count: number | null
          campaign: string | null
          client_id: number | null
          client_name: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          current_budget: number | null
          current_stage: string | null
          last_action_type: string | null
          last_date: string | null
          last_memo: string | null
          manager_id: number | null
          manager_name: string | null
          manager_team: string | null
          product: string | null
          unique_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_manager_id"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_manager_id"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_manager_id"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      media_crm_data_v_daily: {
        Row: {
          ad_revenue: number | null
          click: number | null
          cost_spent: number | null
          created_at: string | null
          ctr: number | null
          date: string | null
          imp: number | null
          manager_id: number | null
          manager_id_second: number | null
          media_id: number | null
          media_name: string | null
          mfr: number | null
          pub_profit: number | null
          service_cv: number | null
          service_id: number | null
          service_name: string | null
          service_type: string | null
          tier: string | null
          updated_at: string | null
          vctr: number | null
          vimp: number | null
          vrate: number | null
          widget_id: string | null
          widget_name: string | null
          widget_name_master: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_data_media"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_crm_media"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "fk_data_service"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "media_crm_service"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      media_crm_data_v_daily_aggregated: {
        Row: {
          ad_revenue: number | null
          click: number | null
          cost_spent: number | null
          ctr: number | null
          date: string | null
          imp: number | null
          mfr: number | null
          pub_profit: number | null
          service_cv: number | null
          total_ad_revenue: number | null
          total_click: number | null
          total_cost_spent: number | null
          total_imp: number | null
          total_mfr: number | null
          total_pub_profit: number | null
          total_service_cv: number | null
          total_vimp: number | null
          vctr: number | null
          vimp: number | null
          vrate: number | null
        }
        Relationships: []
      }
      media_crm_data_v_daily_aggregated_by_media: {
        Row: {
          ad_revenue: number | null
          click: number | null
          cost_spent: number | null
          created_at: string | null
          ctr: number | null
          date: string | null
          imp: number | null
          manager_id: number | null
          manager_id_second: number | null
          media_id: number | null
          media_name: string | null
          mfr: number | null
          pub_profit: number | null
          service_cv: number | null
          service_id: number | null
          service_name: string | null
          service_type: string | null
          tier: string | null
          total_ad_revenue: number | null
          total_click: number | null
          total_cost_spent: number | null
          total_imp: number | null
          total_mfr: number | null
          total_pub_profit: number | null
          total_service_cv: number | null
          total_vimp: number | null
          updated_at: string | null
          vctr: number | null
          vimp: number | null
          vrate: number | null
          widget_id: string | null
          widget_name: string | null
          widget_name_master: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_data_media"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_crm_media"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      media_crm_data_v_daily_aggregated_by_service: {
        Row: {
          ad_revenue: number | null
          click: number | null
          cost_spent: number | null
          created_at: string | null
          ctr: number | null
          date: string | null
          imp: number | null
          manager_id: number | null
          manager_id_second: number | null
          media_id: number | null
          media_name: string | null
          mfr: number | null
          pub_profit: number | null
          service_cv: number | null
          service_id: number | null
          service_name: string | null
          service_type: string | null
          tier: string | null
          total_ad_revenue: number | null
          total_click: number | null
          total_cost_spent: number | null
          total_imp: number | null
          total_mfr: number | null
          total_pub_profit: number | null
          total_service_cv: number | null
          total_vimp: number | null
          updated_at: string | null
          vctr: number | null
          vimp: number | null
          vrate: number | null
          widget_id: string | null
          widget_name: string | null
          widget_name_master: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_data_media"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_crm_media"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "fk_data_service"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "media_crm_service"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "ads_crm_pipeline_summary"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "ads_crm_today_followup"
            referencedColumns: ["manager_id"]
          },
          {
            foreignKeyName: "fk_media_manager_second"
            columns: ["manager_id_second"]
            isOneToOne: false
            referencedRelation: "shared_manager"
            referencedColumns: ["id"]
          },
        ]
      }
      media_crm_v_active_widgets: {
        Row: {
          contract_type: string | null
          contract_value: number | null
          end_date: string | null
          media_id: number | null
          service_id: number | null
          start_date: string | null
          widget_id: string | null
          widget_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_data_media"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_crm_media"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "fk_data_service"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "media_crm_service"
            referencedColumns: ["service_id"]
          },
        ]
      }
    }
    Functions: {
      get_current_week: {
        Args: never
        Returns: {
          end_date: string
          start_date: string
          week_id: string
          week_label: string
          week_number: number
          year: number
        }[]
      }
      get_week_by_date: {
        Args: { target_date: string }
        Returns: {
          end_date: string
          start_date: string
          week_id: string
          week_label: string
          week_number: number
          year: number
        }[]
      }
      get_week_by_offset: {
        Args: { week_offset: number }
        Returns: {
          end_date: string
          start_date: string
          week_id: string
          week_label: string
          week_number: number
          year: number
        }[]
      }
      get_weekly_data: { Args: { p_manager_id?: number }; Returns: Json }
      upsert_data_daily_data_batch: { Args: { p_data: Json }; Returns: Json }
    }
    Enums: {
      ads_crm_action_type: "cold_contact" | "contact" | "meeting"
      ads_crm_client_type: "agency" | "advertiser"
      ads_crm_product: "DNA" | "RMP"
      ads_crm_stage:
        | "contact"
        | "proposed"
        | "negotiation"
        | "closed_won"
        | "closed_lost"
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
      ads_crm_action_type: ["cold_contact", "contact", "meeting"],
      ads_crm_client_type: ["agency", "advertiser"],
      ads_crm_product: ["DNA", "RMP"],
      ads_crm_stage: [
        "contact",
        "proposed",
        "negotiation",
        "closed_won",
        "closed_lost",
      ],
    },
  },
} as const
