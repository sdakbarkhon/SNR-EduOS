export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          target_group_id: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          target_group_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          target_group_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          id: string
          lesson_id: string
          recorded_at: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          id?: string
          lesson_id: string
          recorded_at?: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          id?: string
          lesson_id?: string
          recorded_at?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          amount: number
          charged_at: string
          id: string
          lesson_id: string | null
          note: string | null
          student_id: string
        }
        Insert: {
          amount: number
          charged_at?: string
          id?: string
          lesson_id?: string | null
          note?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          charged_at?: string
          id?: string
          lesson_id?: string | null
          note?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      course_materials: {
        Row: {
          created_at: string
          file_url: string | null
          group_id: string
          id: string
          lesson_id: string | null
          link_url: string | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          group_id: string
          id?: string
          lesson_id?: string | null
          link_url?: string | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          group_id?: string
          id?: string
          lesson_id?: string | null
          link_url?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          comment: string | null
          graded_at: string
          group_id: string | null
          id: string
          lesson_id: string | null
          score: number
          student_id: string
          subject: string | null
          work_type: string | null
        }
        Insert: {
          comment?: string | null
          graded_at?: string
          group_id?: string | null
          id?: string
          lesson_id?: string | null
          score: number
          student_id: string
          subject?: string | null
          work_type?: string | null
        }
        Update: {
          comment?: string | null
          graded_at?: string
          group_id?: string | null
          id?: string
          lesson_id?: string | null
          score?: number
          student_id?: string
          subject?: string | null
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grades_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          course_price: number
          created_at: string
          id: string
          name: string
          schedule_days: string
          subject: string
          teacher_id: string | null
        }
        Insert: {
          course_price?: number
          created_at?: string
          id?: string
          name: string
          schedule_days?: string
          subject: string
          teacher_id?: string | null
        }
        Update: {
          course_price?: number
          created_at?: string
          id?: string
          name?: string
          schedule_days?: string
          subject?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          attachments: Json
          created_at: string
          description: string | null
          due_date: string | null
          group_id: string
          id: string
          lesson_id: string | null
          title: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          description?: string | null
          due_date?: string | null
          group_id: string
          id?: string
          lesson_id?: string | null
          title: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          description?: string | null
          due_date?: string | null
          group_id?: string
          id?: string
          lesson_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          answer_text: string | null
          file_url: string | null
          grade: number | null
          homework_id: string
          id: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string
          teacher_comment: string | null
        }
        Insert: {
          answer_text?: string | null
          file_url?: string | null
          grade?: number | null
          homework_id: string
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string
          teacher_comment?: string | null
        }
        Update: {
          answer_text?: string | null
          file_url?: string | null
          grade?: number | null
          homework_id?: string
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string
          teacher_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          ends_at: string | null
          group_id: string
          id: string
          lesson_no: number | null
          materials_link: string | null
          online_url: string | null
          room: string | null
          starts_at: string
          status: Database["public"]["Enums"]["lesson_status"]
          topic: string | null
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          group_id: string
          id?: string
          lesson_no?: number | null
          materials_link?: string | null
          online_url?: string | null
          room?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["lesson_status"]
          topic?: string | null
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          group_id?: string
          id?: string
          lesson_no?: number | null
          materials_link?: string | null
          online_url?: string | null
          room?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["lesson_status"]
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          group_id: string | null
          id: string
          read_at: string | null
          recipient_student_id: string | null
          sender_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          group_id?: string | null
          id?: string
          read_at?: string | null
          recipient_student_id?: string | null
          sender_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          group_id?: string | null
          id?: string
          read_at?: string | null
          recipient_student_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_student_id_fkey"
            columns: ["recipient_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          push_attendance: boolean
          push_grades: boolean
          push_homework: boolean
          push_schedule: boolean
          student_id: string
          updated_at: string
        }
        Insert: {
          push_attendance?: boolean
          push_grades?: boolean
          push_homework?: boolean
          push_schedule?: boolean
          student_id: string
          updated_at?: string
        }
        Update: {
          push_attendance?: boolean
          push_grades?: boolean
          push_homework?: boolean
          push_schedule?: boolean
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          note: string | null
          paid_at: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
        }
        Insert: {
          amount: number
          id?: string
          kind: Database["public"]["Enums"]["payment_kind"]
          note?: string | null
          paid_at?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
        }
        Update: {
          amount?: number
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          note?: string | null
          paid_at?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_groups: {
        Row: {
          group_id: string
          student_id: string
        }
        Insert: {
          group_id: string
          student_id: string
        }
        Update: {
          group_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_groups_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          avatar_url: string | null
          balance: number
          birth_date: string | null
          created_at: string
          curator_id: string | null
          full_name: string
          grade: string | null
          id: string
          phone: string | null
          status: Database["public"]["Enums"]["student_status"]
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          birth_date?: string | null
          created_at?: string
          curator_id?: string | null
          full_name: string
          grade?: string | null
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          birth_date?: string | null
          created_at?: string
          curator_id?: string | null
          full_name?: string
          grade?: string | null
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_curator_id_fkey"
            columns: ["curator_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_student_id: { Args: never; Returns: string }
      is_my_group: { Args: { p_group_id: string }; Returns: boolean }
    }
    Enums: {
      attendance_status: "present" | "absent" | "late"
      lesson_status: "scheduled" | "ongoing" | "done" | "cancelled"
      payment_kind: "subscription" | "one_time"
      payment_status: "completed" | "pending" | "canceled"
      student_status: "active" | "debtor" | "frozen"
      submission_status: "submitted" | "checking" | "graded"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attendance_status: ["present", "absent", "late"],
      lesson_status: ["scheduled", "ongoing", "done", "cancelled"],
      payment_kind: ["subscription", "one_time"],
      payment_status: ["completed", "pending", "canceled"],
      student_status: ["active", "debtor", "frozen"],
      submission_status: ["submitted", "checking", "graded"],
    },
  },
} as const

