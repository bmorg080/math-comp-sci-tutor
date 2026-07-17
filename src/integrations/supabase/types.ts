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
      account_members: {
        Row: {
          account_id: string
          created_at: string
          email: string
          id: string
          member_role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email: string
          id?: string
          member_role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string
          id?: string
          member_role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string
          display_name: string
          id: string
          notes: string | null
          stripe_customer_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          notes?: string | null
          stripe_customer_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          notes?: string | null
          stripe_customer_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      credits: {
        Row: {
          account_id: string
          consumed_lesson_id: string | null
          expires_at: string
          id: string
          note: string | null
          price_cents_paid: number
          purchased_at: string
          refunded_at: string | null
          source: Database["public"]["Enums"]["credit_source"]
          stripe_payment_id: string | null
        }
        Insert: {
          account_id: string
          consumed_lesson_id?: string | null
          expires_at: string
          id?: string
          note?: string | null
          price_cents_paid?: number
          purchased_at?: string
          refunded_at?: string | null
          source: Database["public"]["Enums"]["credit_source"]
          stripe_payment_id?: string | null
        }
        Update: {
          account_id?: string
          consumed_lesson_id?: string | null
          expires_at?: string
          id?: string
          note?: string | null
          price_cents_paid?: number
          purchased_at?: string
          refunded_at?: string | null
          source?: Database["public"]["Enums"]["credit_source"]
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_prices: {
        Row: {
          account_id: string
          created_at: string
          id: string
          price_cents: number
          subject_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          price_cents: number
          subject_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          price_cents?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_prices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_prices_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          id: string
          idempotency_key: string
          kind: string
          lesson_id: string | null
          recipient: string
          sent_at: string
        }
        Insert: {
          id?: string
          idempotency_key: string
          kind: string
          lesson_id?: string | null
          recipient: string
          sent_at?: string
        }
        Update: {
          id?: string
          idempotency_key?: string
          kind?: string
          lesson_id?: string | null
          recipient?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          account_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          credit_id: string | null
          duration_minutes: number
          id: string
          price_cents_paid: number
          reminder_sent_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["lesson_status"]
          stripe_payment_id: string | null
          student_id: string | null
          subject_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          credit_id?: string | null
          duration_minutes?: number
          id?: string
          price_cents_paid?: number
          reminder_sent_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["lesson_status"]
          stripe_payment_id?: string | null
          student_id?: string | null
          subject_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          credit_id?: string | null
          duration_minutes?: number
          id?: string
          price_cents_paid?: number
          reminder_sent_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["lesson_status"]
          stripe_payment_id?: string | null
          student_id?: string | null
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          bundle_discount_pct: number
          bundle_size: number
          cancellation_hours: number
          credit_expiry_months: number
          id: number
          tutor_bio: string
          tutor_email: string | null
          tutor_name: string
          tutor_timezone: string
          updated_at: string
          weekly_availability: Json
          zoom_link: string
        }
        Insert: {
          bundle_discount_pct?: number
          bundle_size?: number
          cancellation_hours?: number
          credit_expiry_months?: number
          id?: number
          tutor_bio?: string
          tutor_email?: string | null
          tutor_name?: string
          tutor_timezone?: string
          updated_at?: string
          weekly_availability?: Json
          zoom_link?: string
        }
        Update: {
          bundle_discount_pct?: number
          bundle_size?: number
          cancellation_hours?: number
          credit_expiry_months?: number
          id?: number
          tutor_bio?: string
          tutor_email?: string | null
          tutor_name?: string
          tutor_timezone?: string
          updated_at?: string
          weekly_availability?: Json
          zoom_link?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          account_id: string
          created_at: string
          grade_level: string | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          grade_level?: string | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          grade_level?: string | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          price_cents: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_cents: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_cents?: number
          sort_order?: number
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
      current_account_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      public_busy_slots: {
        Args: { _from: string; _to: string }
        Returns: {
          starts_at: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      credit_source:
        | "purchase_single"
        | "purchase_bundle"
        | "admin_grant"
        | "admin_refund"
        | "cancellation_refund"
      lesson_status: "scheduled" | "completed" | "cancelled" | "no_show"
      member_role: "parent" | "student"
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
      app_role: ["admin", "customer"],
      credit_source: [
        "purchase_single",
        "purchase_bundle",
        "admin_grant",
        "admin_refund",
        "cancellation_refund",
      ],
      lesson_status: ["scheduled", "completed", "cancelled", "no_show"],
      member_role: ["parent", "student"],
    },
  },
} as const
