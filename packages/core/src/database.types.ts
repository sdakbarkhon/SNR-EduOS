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
      admins: {
        Row: {
          created_at: string
          full_name: string
          google_email: string | null
          id: string
          school_id: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          google_email?: string | null
          id?: string
          school_id?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          google_email?: string | null
          id?: string
          school_id?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admins_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          lesson_id: string | null
          role: string
          school_id: string
          stage_id: string | null
          student_id: string
          tokens_used: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          role: string
          school_id?: string
          stage_id?: string | null
          student_id: string
          tokens_used?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          role?: string
          school_id?: string
          stage_id?: string | null
          student_id?: string
          tokens_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_messages_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "lesson_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_homework_review_queue: {
        Row: {
          attempts: number
          enqueued_at: string
          last_error: string | null
          school_id: string
          submission_id: string
        }
        Insert: {
          attempts?: number
          enqueued_at?: string
          last_error?: string | null
          school_id: string
          submission_id: string
        }
        Update: {
          attempts?: number
          enqueued_at?: string
          last_error?: string | null
          school_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_homework_review_queue_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "homework_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_reason: string | null
          id: string
          input_tokens: number | null
          model: string
          ok: boolean
          output_tokens: number | null
          school_id: string | null
          student_id: string | null
          task: string
          teacher_id: string | null
          total_tokens: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_reason?: string | null
          id?: string
          input_tokens?: number | null
          model: string
          ok: boolean
          output_tokens?: number | null
          school_id?: string | null
          student_id?: string | null
          task: string
          teacher_id?: string | null
          total_tokens?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_reason?: string | null
          id?: string
          input_tokens?: number | null
          model?: string
          ok?: boolean
          output_tokens?: number | null
          school_id?: string | null
          student_id?: string | null
          task?: string
          teacher_id?: string | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          day: string
          requests_count: number
          updated_at: string
        }
        Insert: {
          day: string
          requests_count?: number
          updated_at?: string
        }
        Update: {
          day?: string
          requests_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          school_id: string
          student_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          school_id?: string
          student_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_user_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          school_id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          school_id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_user_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_user_reads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          admin_id: string | null
          body: string
          category: Database["public"]["Enums"]["announcement_category"]
          created_at: string
          created_by: string | null
          group_id: string | null
          id: string
          is_pinned: boolean
          is_ticker: boolean
          school_id: string
          scope: string
          target_group_id: string | null
          target_student_id: string | null
          title: string
          valid_until: string | null
          admin_name: string | null
        }
        Insert: {
          admin_id?: string | null
          body: string
          category?: Database["public"]["Enums"]["announcement_category"]
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          is_pinned?: boolean
          is_ticker?: boolean
          school_id?: string
          scope: string
          target_group_id?: string | null
          target_student_id?: string | null
          title: string
          valid_until?: string | null
        }
        Update: {
          admin_id?: string | null
          body?: string
          category?: Database["public"]["Enums"]["announcement_category"]
          created_at?: string
          created_by?: string | null
          group_id?: string | null
          id?: string
          is_pinned?: boolean
          is_ticker?: boolean
          school_id?: string
          scope?: string
          target_group_id?: string | null
          target_student_id?: string | null
          title?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_target_student_id_fkey"
            columns: ["target_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          id: string
          is_finalized: boolean
          lesson_id: string
          marked_at: string
          marked_by: string | null
          recorded_at: string
          school_id: string
          status: string
          student_id: string
        }
        Insert: {
          id?: string
          is_finalized?: boolean
          lesson_id: string
          marked_at?: string
          marked_by?: string | null
          recorded_at?: string
          school_id?: string
          status?: string
          student_id: string
        }
        Update: {
          id?: string
          is_finalized?: boolean
          lesson_id?: string
          marked_at?: string
          marked_by?: string | null
          recorded_at?: string
          school_id?: string
          status?: string
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
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
      book_favorites: {
        Row: {
          book_id: string
          created_at: string
          id: string
          school_id: string
          student_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          school_id?: string
          student_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_favorites_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_favorites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_favorites_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author: string | null
          book_type: string
          cover_storage_path: string | null
          created_at: string
          description: string | null
          external_url: string | null
          file_size_bytes: number | null
          file_storage_path: string | null
          id: string
          school_id: string
          subject: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          author?: string | null
          book_type?: string
          cover_storage_path?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_size_bytes?: number | null
          file_storage_path?: string | null
          id?: string
          school_id?: string
          subject: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          author?: string | null
          book_type?: string
          cover_storage_path?: string | null
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_size_bytes?: number | null
          file_storage_path?: string | null
          id?: string
          school_id?: string
          subject?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
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
          school_id: string
          student_id: string
        }
        Insert: {
          amount: number
          charged_at?: string
          id?: string
          lesson_id?: string | null
          note?: string | null
          school_id?: string
          student_id: string
        }
        Update: {
          amount?: number
          charged_at?: string
          id?: string
          lesson_id?: string | null
          note?: string | null
          school_id?: string
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
            foreignKeyName: "charges_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
      chat_messages: {
        Row: {
          attachments: Json | null
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          school_id: string
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          attachments?: Json | null
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          school_id?: string
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          attachments?: Json | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          school_id?: string
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          joined_at: string
          role_in_thread: string
          thread_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role_in_thread: string
          thread_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role_in_thread?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_state: {
        Row: {
          last_read_message_id: string | null
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_read_message_id?: string | null
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_read_message_id?: string | null
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_state_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_read_state_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          kind: string
          school_id: string
          student_id: string | null
          teacher_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          kind: string
          school_id?: string
          student_id?: string | null
          teacher_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          kind?: string
          school_id?: string
          student_id?: string | null
          teacher_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      classwork: {
        Row: {
          attachment_filename: string | null
          attachment_size_bytes: number | null
          attachment_storage_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          lesson_id: string
          school_id: string
          title: string
          work_type: string
        }
        Insert: {
          attachment_filename?: string | null
          attachment_size_bytes?: number | null
          attachment_storage_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          lesson_id: string
          school_id?: string
          title: string
          work_type?: string
        }
        Update: {
          attachment_filename?: string | null
          attachment_size_bytes?: number | null
          attachment_storage_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          lesson_id?: string
          school_id?: string
          title?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "classwork_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classwork_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classwork_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classwork_questions: {
        Row: {
          classwork_id: string
          correct_index: number
          id: string
          options: Json
          position: number
          question_text: string
          school_id: string
        }
        Insert: {
          classwork_id: string
          correct_index?: number
          id?: string
          options?: Json
          position?: number
          question_text: string
          school_id?: string
        }
        Update: {
          classwork_id?: string
          correct_index?: number
          id?: string
          options?: Json
          position?: number
          question_text?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classwork_questions_classwork_id_fkey"
            columns: ["classwork_id"]
            isOneToOne: false
            referencedRelation: "classwork"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classwork_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classwork_submissions: {
        Row: {
          classwork_id: string
          file_original_name: string | null
          file_size_bytes: number | null
          file_storage_path: string | null
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          school_id: string
          student_id: string
          submitted_at: string
          teacher_comment: string | null
          test_answers: Json | null
          test_max: number | null
          test_score: number | null
          text_answer: string | null
        }
        Insert: {
          classwork_id: string
          file_original_name?: string | null
          file_size_bytes?: number | null
          file_storage_path?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          school_id?: string
          student_id: string
          submitted_at?: string
          teacher_comment?: string | null
          test_answers?: Json | null
          test_max?: number | null
          test_score?: number | null
          text_answer?: string | null
        }
        Update: {
          classwork_id?: string
          file_original_name?: string | null
          file_size_bytes?: number | null
          file_storage_path?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          school_id?: string
          student_id?: string
          submitted_at?: string
          teacher_comment?: string | null
          test_answers?: Json | null
          test_max?: number | null
          test_score?: number | null
          text_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classwork_submissions_classwork_id_fkey"
            columns: ["classwork_id"]
            isOneToOne: false
            referencedRelation: "classwork"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classwork_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classwork_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classwork_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      course_materials: {
        Row: {
          bucket: string
          created_at: string
          description: string | null
          file_size_bytes: number | null
          file_type: string | null
          file_url: string | null
          group_id: string
          id: string
          lesson_id: string | null
          link_url: string | null
          school_id: string
          stage_id: string | null
          storage_path: string | null
          subject: string | null
          title: string
          type: string | null
          uploaded_by: string | null
        }
        Insert: {
          bucket?: string
          created_at?: string
          description?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string | null
          group_id: string
          id?: string
          lesson_id?: string | null
          link_url?: string | null
          school_id?: string
          stage_id?: string | null
          storage_path?: string | null
          subject?: string | null
          title: string
          type?: string | null
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          description?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string | null
          group_id?: string
          id?: string
          lesson_id?: string | null
          link_url?: string | null
          school_id?: string
          stage_id?: string | null
          storage_path?: string | null
          subject?: string | null
          title?: string
          type?: string | null
          uploaded_by?: string | null
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
          {
            foreignKeyName: "course_materials_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_materials_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "lesson_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_plan_topics: {
        Row: {
          description: string | null
          estimated_lessons: number
          id: string
          order_index: number
          plan_id: string
          title: string
        }
        Insert: {
          description?: string | null
          estimated_lessons?: number
          id?: string
          order_index: number
          plan_id: string
          title: string
        }
        Update: {
          description?: string | null
          estimated_lessons?: number
          id?: string
          order_index?: number
          plan_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_plan_topics_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "curriculum_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_plans: {
        Row: {
          created_at: string
          error_message: string | null
          group_id: string
          id: string
          progress_percent: number
          progress_stage: string | null
          school_id: string
          source_book_id: string | null
          source_file_type: string | null
          source_file_url: string | null
          status: string
          subject_id: string
          teacher_id: string
          title: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          group_id: string
          id?: string
          progress_percent?: number
          progress_stage?: string | null
          school_id?: string
          source_book_id?: string | null
          source_file_type?: string | null
          source_file_url?: string | null
          status?: string
          subject_id: string
          teacher_id: string
          title: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          group_id?: string
          id?: string
          progress_percent?: number
          progress_stage?: string | null
          school_id?: string
          source_book_id?: string | null
          source_file_type?: string | null
          source_file_url?: string | null
          status?: string
          subject_id?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_plans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_plans_source_book_id_fkey"
            columns: ["source_book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_plans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_facts: {
        Row: {
          created_at: string
          fact_date: string
          fact_text: string
          id: string
          school_id: string
        }
        Insert: {
          created_at?: string
          fact_date: string
          fact_text: string
          id?: string
          school_id?: string
        }
        Update: {
          created_at?: string
          fact_date?: string
          fact_text?: string
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_facts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_baseline: {
        Row: {
          entity_id: string
          entity_type: string
          school_id: string
          taken_at: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          school_id: string
          taken_at?: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          school_id?: string
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_baseline_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_leases: {
        Row: {
          claimed_at: string
          id: string
          last_activity_at: string
          released_at: string | null
          role: string
          school_id: string
          session_token: string
          subject_slug: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          last_activity_at?: string
          released_at?: string | null
          role: string
          school_id: string
          session_token: string
          subject_slug?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          last_activity_at?: string
          released_at?: string | null
          role?: string
          school_id?: string
          session_token?: string
          subject_slug?: string | null
          user_id?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          comment: string | null
          graded_at: string
          group_id: string | null
          id: string
          lesson_id: string | null
          school_id: string
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
          school_id?: string
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
          school_id?: string
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
            foreignKeyName: "grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
      group_teachers: {
        Row: {
          created_at: string
          group_id: string
          school_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          school_id?: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          school_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_teachers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
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
          school_id: string
          subject: string
          teacher_id: string | null
        }
        Insert: {
          course_price?: number
          created_at?: string
          id?: string
          name: string
          schedule_days?: string
          school_id?: string
          subject: string
          teacher_id?: string | null
        }
        Update: {
          course_price?: number
          created_at?: string
          id?: string
          name?: string
          schedule_days?: string
          school_id?: string
          subject?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      h5p_content: {
        Row: {
          content_type: string
          created_at: string
          created_by: string | null
          id: string
          is_public: boolean
          school_id: string | null
          storage_path: string
          title: string
          updated_at: string
        }
        Insert: {
          content_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean
          school_id?: string | null
          storage_path: string
          title: string
          updated_at?: string
        }
        Update: {
          content_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean
          school_id?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "h5p_content_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          attachment_content_type: string
          attachment_external_url: string | null
          attachment_filename: string | null
          attachment_size_bytes: number | null
          attachment_source_url: string | null
          attachment_storage_path: string | null
          attachments: Json
          code_completion_data: Json | null
          content_type: string
          created_at: string
          description: string | null
          due_date: string | null
          expected_output: string | null
          external_url: string | null
          group_id: string
          hint_filename: string | null
          hint_mime_type: string | null
          hint_storage_path: string | null
          id: string
          lesson_id: string | null
          programming_language: string | null
          school_id: string
          source: Database["public"]["Enums"]["homework_source"]
          starter_code: string | null
          subject_id: string | null
          teacher_id: string | null
          test_auto_grade: boolean
          test_duration_seconds: number | null
          tests_attachment_filename: string | null
          tests_attachment_path: string | null
          tests_attachment_size_bytes: number | null
          title: string
        }
        Insert: {
          attachment_content_type?: string
          attachment_external_url?: string | null
          attachment_filename?: string | null
          attachment_size_bytes?: number | null
          attachment_source_url?: string | null
          attachment_storage_path?: string | null
          attachments?: Json
          code_completion_data?: Json | null
          content_type?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          expected_output?: string | null
          external_url?: string | null
          group_id: string
          hint_filename?: string | null
          hint_mime_type?: string | null
          hint_storage_path?: string | null
          id?: string
          lesson_id?: string | null
          programming_language?: string | null
          school_id?: string
          source?: Database["public"]["Enums"]["homework_source"]
          starter_code?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          test_auto_grade?: boolean
          test_duration_seconds?: number | null
          tests_attachment_filename?: string | null
          tests_attachment_path?: string | null
          tests_attachment_size_bytes?: number | null
          title: string
        }
        Update: {
          attachment_content_type?: string
          attachment_external_url?: string | null
          attachment_filename?: string | null
          attachment_size_bytes?: number | null
          attachment_source_url?: string | null
          attachment_storage_path?: string | null
          attachments?: Json
          code_completion_data?: Json | null
          content_type?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          expected_output?: string | null
          external_url?: string | null
          group_id?: string
          hint_filename?: string | null
          hint_mime_type?: string | null
          hint_storage_path?: string | null
          id?: string
          lesson_id?: string | null
          programming_language?: string | null
          school_id?: string
          source?: Database["public"]["Enums"]["homework_source"]
          starter_code?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          test_auto_grade?: boolean
          test_duration_seconds?: number | null
          tests_attachment_filename?: string | null
          tests_attachment_path?: string | null
          tests_attachment_size_bytes?: number | null
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
          {
            foreignKeyName: "homework_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          ai_feedback: Json | null
          ai_grade: number | null
          ai_review_status: string | null
          ai_reviewed_at: string | null
          answer_text: string | null
          code_completion_answers: Json | null
          code_text: string | null
          file_original_name: string | null
          file_size_bytes: number | null
          file_storage_path: string | null
          file_url: string | null
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          homework_id: string
          id: string
          school_id: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string
          teacher_approved_at: string | null
          teacher_approved_by: string | null
          teacher_comment: string | null
        }
        Insert: {
          ai_feedback?: Json | null
          ai_grade?: number | null
          ai_review_status?: string | null
          ai_reviewed_at?: string | null
          answer_text?: string | null
          code_completion_answers?: Json | null
          code_text?: string | null
          file_original_name?: string | null
          file_size_bytes?: number | null
          file_storage_path?: string | null
          file_url?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          homework_id: string
          id?: string
          school_id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string
          teacher_approved_at?: string | null
          teacher_approved_by?: string | null
          teacher_comment?: string | null
        }
        Update: {
          ai_feedback?: Json | null
          ai_grade?: number | null
          ai_review_status?: string | null
          ai_reviewed_at?: string | null
          answer_text?: string | null
          code_completion_answers?: Json | null
          code_text?: string | null
          file_original_name?: string | null
          file_size_bytes?: number | null
          file_storage_path?: string | null
          file_url?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          homework_id?: string
          id?: string
          school_id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string
          teacher_approved_at?: string | null
          teacher_approved_by?: string | null
          teacher_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_teacher_approved_by_fkey"
            columns: ["teacher_approved_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_subtask_submissions: {
        Row: {
          completed: boolean
          content: Json
          created_at: string
          id: string
          school_id: string
          submission_id: string
          subtask_id: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          content?: Json
          created_at?: string
          id?: string
          school_id?: string
          submission_id: string
          subtask_id: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          content?: Json
          created_at?: string
          id?: string
          school_id?: string
          submission_id?: string
          subtask_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_subtask_submissions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "homework_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_subtask_submissions_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "homework_subtasks"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_subtasks: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          homework_id: string
          id: string
          order_index: number
          school_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          homework_id: string
          id?: string
          order_index?: number
          school_id?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          homework_id?: string
          id?: string
          order_index?: number
          school_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_subtasks_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
        ]
      }
      kahoot_sessions: {
        Row: {
          current_question_index: number
          finished_at: string | null
          id: string
          question_started_at: string | null
          school_id: string
          stage_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          current_question_index?: number
          finished_at?: string | null
          id?: string
          question_started_at?: string | null
          school_id?: string
          stage_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          current_question_index?: number
          finished_at?: string | null
          id?: string
          question_started_at?: string | null
          school_id?: string
          stage_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kahoot_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kahoot_sessions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: true
            referencedRelation: "lesson_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          lesson_id: string
          reason: string
          school_id: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          lesson_id: string
          reason: string
          school_id?: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          lesson_id?: string
          reason?: string
          school_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_excuse_requests: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          reason: string
          school_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          reason: string
          school_id?: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          reason?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_excuse_requests_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_excuse_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_excuse_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_grades: {
        Row: {
          comment: string | null
          grade: number
          graded_at: string
          graded_by: string
          id: string
          lesson_id: string
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          grade: number
          graded_at?: string
          graded_by: string
          id?: string
          lesson_id: string
          school_id?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          grade?: number
          graded_at?: string
          graded_by?: string
          id?: string
          lesson_id?: string
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_grades_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_grades_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_materials: {
        Row: {
          content_type: string
          created_at: string
          external_url: string | null
          file_original_name: string | null
          file_size_bytes: number | null
          file_storage_path: string | null
          from_knowledge_base: boolean
          id: string
          kb_bucket: string | null
          lesson_id: string
          school_id: string
          source_url: string | null
          title: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          content_type?: string
          created_at?: string
          external_url?: string | null
          file_original_name?: string | null
          file_size_bytes?: number | null
          file_storage_path?: string | null
          from_knowledge_base?: boolean
          id?: string
          kb_bucket?: string | null
          lesson_id: string
          school_id?: string
          source_url?: string | null
          title: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          content_type?: string
          created_at?: string
          external_url?: string | null
          file_original_name?: string | null
          file_size_bytes?: number | null
          file_storage_path?: string | null
          from_knowledge_base?: boolean
          id?: string
          kb_bucket?: string | null
          lesson_id?: string
          school_id?: string
          source_url?: string | null
          title?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_materials_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_raised_hands: {
        Row: {
          id: string
          lesson_id: string
          lowered_at: string | null
          lowered_by: string | null
          raised_at: string
          school_id: string
          student_id: string
        }
        Insert: {
          id?: string
          lesson_id: string
          lowered_at?: string | null
          lowered_by?: string | null
          raised_at?: string
          school_id?: string
          student_id: string
        }
        Update: {
          id?: string
          lesson_id?: string
          lowered_at?: string | null
          lowered_by?: string | null
          raised_at?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_raised_hands_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_raised_hands_lowered_by_fkey"
            columns: ["lowered_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_raised_hands_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_raised_hands_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_stage_embeddings: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string
          embedding: string
          id: string
          lesson_stage_id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          chunk_index?: number
          chunk_text: string
          created_at?: string
          embedding: string
          id?: string
          lesson_stage_id: string
          school_id: string
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          embedding?: string
          id?: string
          lesson_stage_id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_stage_embeddings_lesson_stage_id_fkey"
            columns: ["lesson_stage_id"]
            isOneToOne: false
            referencedRelation: "lesson_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_stage_embeddings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_stage_progress: {
        Row: {
          completed_at: string | null
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_completed: boolean
          school_id: string
          stage_id: string
          student_id: string
          submission_data: Json | null
          teacher_comment: string | null
        }
        Insert: {
          completed_at?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_completed?: boolean
          school_id?: string
          stage_id: string
          student_id: string
          submission_data?: Json | null
          teacher_comment?: string | null
        }
        Update: {
          completed_at?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_completed?: boolean
          school_id?: string
          stage_id?: string
          student_id?: string
          submission_data?: Json | null
          teacher_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_stage_progress_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_stage_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_stage_progress_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "lesson_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_stage_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_stages: {
        Row: {
          completed_at: string | null
          config: Json
          content_type: string | null
          created_at: string
          current_slide_index: number
          description: string | null
          difficulty: string | null
          duration_min: number | null
          expected_output: string | null
          id: string
          image_url: string | null
          is_completed: boolean
          is_live_active: boolean | null
          lesson_id: string
          live_code: string | null
          media_error: string | null
          media_queued_at: string | null
          media_source: string | null
          media_status: string | null
          mermaid_code: string | null
          position: number
          programming_language: string | null
          school_id: string
          slides: Json | null
          stage_role: string
          stage_type: string | null
          starter_code: string | null
          teacher_notes: string | null
          title: string
          was_activated: boolean
        }
        Insert: {
          completed_at?: string | null
          config?: Json
          content_type?: string | null
          created_at?: string
          current_slide_index?: number
          description?: string | null
          difficulty?: string | null
          duration_min?: number | null
          expected_output?: string | null
          id?: string
          image_url?: string | null
          is_completed?: boolean
          is_live_active?: boolean | null
          lesson_id: string
          live_code?: string | null
          media_error?: string | null
          media_queued_at?: string | null
          media_source?: string | null
          media_status?: string | null
          mermaid_code?: string | null
          position: number
          programming_language?: string | null
          school_id?: string
          slides?: Json | null
          stage_role: string
          stage_type?: string | null
          starter_code?: string | null
          teacher_notes?: string | null
          title: string
          was_activated?: boolean
        }
        Update: {
          completed_at?: string | null
          config?: Json
          content_type?: string | null
          created_at?: string
          current_slide_index?: number
          description?: string | null
          difficulty?: string | null
          duration_min?: number | null
          expected_output?: string | null
          id?: string
          image_url?: string | null
          is_completed?: boolean
          is_live_active?: boolean | null
          lesson_id?: string
          live_code?: string | null
          media_error?: string | null
          media_queued_at?: string | null
          media_source?: string | null
          media_status?: string | null
          mermaid_code?: string | null
          position?: number
          programming_language?: string | null
          school_id?: string
          slides?: Json | null
          stage_role?: string
          stage_type?: string | null
          starter_code?: string | null
          teacher_notes?: string | null
          title?: string
          was_activated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lesson_stages_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_stages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_stages_embedding_queue: {
        Row: {
          attempts: number
          enqueued_at: string
          last_error: string | null
          lesson_stage_id: string
          school_id: string
        }
        Insert: {
          attempts?: number
          enqueued_at?: string
          last_error?: string | null
          lesson_stage_id: string
          school_id: string
        }
        Update: {
          attempts?: number
          enqueued_at?: string
          last_error?: string | null
          lesson_stage_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_stages_embedding_queue_lesson_stage_id_fkey"
            columns: ["lesson_stage_id"]
            isOneToOne: true
            referencedRelation: "lesson_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          active_stage_id: string | null
          created_at: string
          curriculum_topic_id: string | null
          demo_current_page: number | null
          demo_material_id: string | null
          demo_video_playing: boolean | null
          demo_video_time: number | null
          description: string | null
          duration_minutes: number | null
          ended_at: string | null
          ends_at: string | null
          group_id: string
          id: string
          lesson_no: number | null
          materials_link: string | null
          online_url: string | null
          room: string | null
          school_id: string
          started_at: string | null
          starts_at: string
          status: string
          subject_id: string | null
          title: string | null
          topic: string | null
        }
        Insert: {
          active_stage_id?: string | null
          created_at?: string
          curriculum_topic_id?: string | null
          demo_current_page?: number | null
          demo_material_id?: string | null
          demo_video_playing?: boolean | null
          demo_video_time?: number | null
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          ends_at?: string | null
          group_id: string
          id?: string
          lesson_no?: number | null
          materials_link?: string | null
          online_url?: string | null
          room?: string | null
          school_id?: string
          started_at?: string | null
          starts_at: string
          status?: string
          subject_id?: string | null
          title?: string | null
          topic?: string | null
        }
        Update: {
          active_stage_id?: string | null
          created_at?: string
          curriculum_topic_id?: string | null
          demo_current_page?: number | null
          demo_material_id?: string | null
          demo_video_playing?: boolean | null
          demo_video_time?: number | null
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          ends_at?: string | null
          group_id?: string
          id?: string
          lesson_no?: number | null
          materials_link?: string | null
          online_url?: string | null
          room?: string | null
          school_id?: string
          started_at?: string | null
          starts_at?: string
          status?: string
          subject_id?: string | null
          title?: string | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_active_stage_id_fkey"
            columns: ["active_stage_id"]
            isOneToOne: false
            referencedRelation: "lesson_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_curriculum_topic_id_fkey"
            columns: ["curriculum_topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_plan_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_demo_material_id_fkey"
            columns: ["demo_material_id"]
            isOneToOne: false
            referencedRelation: "lesson_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
      notification_settings: {
        Row: {
          push_attendance: boolean
          push_grades: boolean
          push_homework: boolean
          push_schedule: boolean
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          push_attendance?: boolean
          push_grades?: boolean
          push_homework?: boolean
          push_schedule?: boolean
          school_id?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          push_attendance?: boolean
          push_grades?: boolean
          push_homework?: boolean
          push_schedule?: boolean
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_settings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          kind: string
          link: string | null
          read_at: string | null
          recipient_user_id: string
          school_id: string
          source_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind: string
          link?: string | null
          read_at?: string | null
          recipient_user_id: string
          school_id?: string
          source_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string
          link?: string | null
          read_at?: string | null
          recipient_user_id?: string
          school_id?: string
          source_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_insights: {
        Row: {
          child_id: string
          generated_at: string
          id: string
          insight_json: Json
          locale: string
          school_id: string
        }
        Insert: {
          child_id: string
          generated_at?: string
          id?: string
          insight_json: Json
          locale?: string
          school_id: string
        }
        Update: {
          child_id?: string
          generated_at?: string
          id?: string
          insight_json?: Json
          locale?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_insights_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          parent_id: string
          school_id: string
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          parent_id: string
          school_id?: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          parent_id?: string
          school_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_invites_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_invites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_phone_codes: {
        Row: {
          attempts: number
          code_hash: string
          code_plain: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          code_plain?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          code_plain?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          used_at?: string | null
        }
        Relationships: []
      }
      parent_students: {
        Row: {
          created_at: string
          parent_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          parent_id: string
          school_id?: string
          student_id: string
        }
        Update: {
          created_at?: string
          parent_id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          apple_email: string | null
          created_at: string
          created_by: string | null
          full_name: string
          google_email: string | null
          id: string
          phone: string
          school_id: string
          user_id: string | null
        }
        Insert: {
          apple_email?: string | null
          created_at?: string
          created_by?: string | null
          full_name: string
          google_email?: string | null
          id?: string
          phone: string
          school_id?: string
          user_id?: string | null
        }
        Update: {
          apple_email?: string | null
          created_at?: string
          created_by?: string | null
          full_name?: string
          google_email?: string | null
          id?: string
          phone?: string
          school_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
        }
        Insert: {
          amount: number
          id?: string
          kind: Database["public"]["Enums"]["payment_kind"]
          note?: string | null
          paid_at?: string
          school_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
        }
        Update: {
          amount?: number
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          note?: string | null
          paid_at?: string
          school_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      project_attachments: {
        Row: {
          id: string
          original_filename: string
          school_id: string
          size_bytes: number | null
          stage_id: string | null
          storage_path: string
          submission_id: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          original_filename: string
          school_id?: string
          size_bytes?: number | null
          stage_id?: string | null
          storage_path: string
          submission_id: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          original_filename?: string
          school_id?: string
          size_bytes?: number | null
          stage_id?: string | null
          storage_path?: string
          submission_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_attachments_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_attachments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "project_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stage_progress: {
        Row: {
          completed_at: string | null
          id: string
          is_completed: boolean
          school_id: string
          stage_id: string
          student_notes: string | null
          submission_id: string
          teacher_comment: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          school_id?: string
          stage_id: string
          student_notes?: string | null
          submission_id: string
          teacher_comment?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          school_id?: string
          stage_id?: string
          student_notes?: string | null
          submission_id?: string
          teacher_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_stage_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_stage_progress_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_stage_progress_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "project_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          description: string | null
          id: string
          position: number
          project_id: string
          school_id: string
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          position: number
          project_id: string
          school_id?: string
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          position?: number
          project_id?: string
          school_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_stages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      project_submissions: {
        Row: {
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_submitted: boolean
          project_id: string
          school_id: string
          student_id: string
          submitted_at: string | null
          teacher_comment: string | null
        }
        Insert: {
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_submitted?: boolean
          project_id: string
          school_id?: string
          student_id: string
          submitted_at?: string | null
          teacher_comment?: string | null
        }
        Update: {
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_submitted?: boolean
          project_id?: string
          school_id?: string
          student_id?: string
          submitted_at?: string | null
          teacher_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          group_id: string
          id: string
          school_id: string
          subject: string
          title: string
        }
        Insert: {
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          group_id: string
          id?: string
          school_id?: string
          subject: string
          title: string
        }
        Update: {
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          group_id?: string
          id?: string
          school_id?: string
          subject?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          id: string
          is_correct: boolean | null
          question_id: string
          response_time_ms: number | null
          school_id: string
          score: number
          selected_option_index: number | null
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          response_time_ms?: number | null
          school_id?: string
          score?: number
          selected_option_index?: number | null
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          response_time_ms?: number | null
          school_id?: string
          score?: number
          selected_option_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          correct_count: number
          finished_at: string | null
          id: string
          is_finalized: boolean
          school_id: string
          stage_id: string
          started_at: string
          student_id: string
          total_questions: number
          total_score: number
        }
        Insert: {
          correct_count?: number
          finished_at?: string | null
          id?: string
          is_finalized?: boolean
          school_id?: string
          stage_id: string
          started_at?: string
          student_id: string
          total_questions?: number
          total_score?: number
        }
        Update: {
          correct_count?: number
          finished_at?: string | null
          id?: string
          is_finalized?: boolean
          school_id?: string
          stage_id?: string
          started_at?: string
          student_id?: string
          total_questions?: number
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "lesson_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_option_index: number
          id: string
          options: Json
          points: number
          position: number
          question_text: string
          school_id: string
          stage_id: string
          time_per_question_seconds: number
        }
        Insert: {
          correct_option_index: number
          id?: string
          options: Json
          points?: number
          position: number
          question_text: string
          school_id?: string
          stage_id: string
          time_per_question_seconds?: number
        }
        Update: {
          correct_option_index?: number
          id?: string
          options?: Json
          points?: number
          position?: number
          question_text?: string
          school_id?: string
          stage_id?: string
          time_per_question_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "lesson_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_counters: {
        Row: {
          action: string
          hits: number
          subject: string
          window_start: string
        }
        Insert: {
          action: string
          hits?: number
          subject: string
          window_start?: string
        }
        Update: {
          action?: string
          hits?: number
          subject?: string
          window_start?: string
        }
        Relationships: []
      }
      sandbox_projects: {
        Row: {
          code: string | null
          created_at: string
          external_url: string | null
          file_path: string | null
          homework_id: string | null
          id: string
          is_autosave: boolean
          lesson_stage_id: string | null
          name: string
          origin: string
          school_id: string
          service_id: string
          shared_with_class: boolean
          student_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          external_url?: string | null
          file_path?: string | null
          homework_id?: string | null
          id?: string
          is_autosave?: boolean
          lesson_stage_id?: string | null
          name?: string
          origin?: string
          school_id?: string
          service_id: string
          shared_with_class?: boolean
          student_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          external_url?: string | null
          file_path?: string | null
          homework_id?: string | null
          id?: string
          is_autosave?: boolean
          lesson_stage_id?: string | null
          name?: string
          origin?: string
          school_id?: string
          service_id?: string
          shared_with_class?: boolean
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_projects_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sandbox_projects_lesson_stage_id_fkey"
            columns: ["lesson_stage_id"]
            isOneToOne: false
            referencedRelation: "lesson_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sandbox_projects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sandbox_projects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      school_analytics_reviews: {
        Row: {
          facts_hash: string
          generated_at: string
          model: string | null
          review_text: string
          school_id: string
        }
        Insert: {
          facts_hash: string
          generated_at?: string
          model?: string | null
          review_text: string
          school_id: string
        }
        Update: {
          facts_hash?: string
          generated_at?: string
          model?: string | null
          review_text?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_analytics_reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_subjects: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          autostart_enabled: boolean
          code: string | null
          created_at: string
          director_name: string | null
          email: string | null
          frozen_date: string | null
          id: string
          is_active: boolean
          is_demo: boolean
          legal_details: string | null
          logo_path: string | null
          name: string
          nightly_close_enabled: boolean
          phone: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          autostart_enabled?: boolean
          code?: string | null
          created_at?: string
          director_name?: string | null
          email?: string | null
          frozen_date?: string | null
          id?: string
          is_active?: boolean
          is_demo?: boolean
          legal_details?: string | null
          logo_path?: string | null
          name: string
          nightly_close_enabled?: boolean
          phone?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          autostart_enabled?: boolean
          code?: string | null
          created_at?: string
          director_name?: string | null
          email?: string | null
          frozen_date?: string | null
          id?: string
          is_active?: boolean
          is_demo?: boolean
          legal_details?: string | null
          logo_path?: string | null
          name?: string
          nightly_close_enabled?: boolean
          phone?: string | null
          website?: string | null
        }
        Relationships: []
      }
      student_groups: {
        Row: {
          group_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          group_id: string
          school_id?: string
          student_id: string
        }
        Update: {
          group_id?: string
          school_id?: string
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
            foreignKeyName: "student_groups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          google_email: string | null
          grade: string | null
          id: string
          phone: string | null
          school_id: string
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
          google_email?: string | null
          grade?: string | null
          id?: string
          phone?: string | null
          school_id?: string
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
          google_email?: string | null
          grade?: string | null
          id?: string
          phone?: string | null
          school_id?: string
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
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          catalog_id: string | null
          color: string
          created_at: string
          group_id: string
          icon: string
          id: string
          is_active: boolean
          is_stub: boolean
          name: string
          school_id: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          catalog_id?: string | null
          color?: string
          created_at?: string
          group_id: string
          icon?: string
          id?: string
          is_active?: boolean
          is_stub?: boolean
          name: string
          school_id?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          catalog_id?: string | null
          color?: string
          created_at?: string
          group_id?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_stub?: boolean
          name?: string
          school_id?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "school_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          full_name: string
          google_email: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          google_email?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          google_email?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      superadmin_journal: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          at: string
          details: Json
          id: number
          outcome: string
          ref: number | null
          target_id: string | null
          target_name: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          at?: string
          details?: Json
          id?: never
          outcome: string
          ref?: number | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          at?: string
          details?: Json
          id?: never
          outcome?: string
          ref?: number | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      teacher_library_material_groups: {
        Row: {
          group_id: string
          material_id: string
          school_id: string
        }
        Insert: {
          group_id: string
          material_id: string
          school_id?: string
        }
        Update: {
          group_id?: string
          material_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_library_material_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_library_material_groups_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "teacher_library_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_library_material_groups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_library_materials: {
        Row: {
          author: string | null
          content_type: string
          created_at: string
          description: string | null
          external_url: string | null
          file_size_bytes: number | null
          file_type: string | null
          id: string
          kb_bucket: string | null
          material_type: string | null
          school_id: string
          source_url: string | null
          storage_path: string | null
          subject_slug: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          author?: string | null
          content_type?: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          kb_bucket?: string | null
          material_type?: string | null
          school_id?: string
          source_url?: string | null
          storage_path?: string | null
          subject_slug?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          author?: string | null
          content_type?: string
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          kb_bucket?: string | null
          material_type?: string | null
          school_id?: string
          source_url?: string | null
          storage_path?: string | null
          subject_slug?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_library_materials_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_library_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string
          google_email: string | null
          id: string
          notification_preferences: Json | null
          phone: string | null
          school_id: string
          subject_slug: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name: string
          google_email?: string | null
          id?: string
          notification_preferences?: Json | null
          phone?: string | null
          school_id?: string
          subject_slug?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string
          google_email?: string | null
          id?: string
          notification_preferences?: Json | null
          phone?: string | null
          school_id?: string
          subject_slug?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      test_answers: {
        Row: {
          id: string
          is_correct: boolean | null
          open_text: string | null
          question_id: string
          school_id: string
          selected_option_id: string | null
          submission_id: string
        }
        Insert: {
          id?: string
          is_correct?: boolean | null
          open_text?: string | null
          question_id: string
          school_id?: string
          selected_option_id?: string | null
          submission_id: string
        }
        Update: {
          id?: string
          is_correct?: boolean | null
          open_text?: string | null
          question_id?: string
          school_id?: string
          selected_option_id?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_answers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "test_question_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "test_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_question_options: {
        Row: {
          id: string
          is_correct: boolean
          option_text: string
          order_index: number
          question_id: string
          school_id: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          option_text: string
          order_index?: number
          question_id: string
          school_id?: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          option_text?: string
          order_index?: number
          question_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_question_options_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions: {
        Row: {
          homework_id: string
          id: string
          order_index: number
          question_text: string
          question_type: string
          school_id: string
        }
        Insert: {
          homework_id: string
          id?: string
          order_index?: number
          question_text: string
          question_type: string
          school_id?: string
        }
        Update: {
          homework_id?: string
          id?: string
          order_index?: number
          question_text?: string
          question_type?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      test_submissions: {
        Row: {
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          homework_id: string
          id: string
          max_score: number | null
          school_id: string
          score: number | null
          started_at: string | null
          student_id: string
          submitted_at: string
        }
        Insert: {
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          homework_id: string
          id?: string
          max_score?: number | null
          school_id?: string
          score?: number | null
          started_at?: string | null
          student_id: string
          submitted_at?: string
        }
        Update: {
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          homework_id?: string
          id?: string
          max_score?: number | null
          school_id?: string
          score?: number | null
          started_at?: string | null
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          device_info: string | null
          id: string
          last_activity: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          id?: string
          last_activity?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          id?: string
          last_activity?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      chat_parent_names: {
        Row: {
          full_name: string | null
          user_id: string | null
        }
        Insert: {
          full_name?: string | null
          user_id?: string | null
        }
        Update: {
          full_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_name: {
        Args: { "": unknown }
        Returns: string
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      can_manage_curriculum_plan: {
        Args: {
          p_group_id: string
          p_school_id: string
          p_subject_id: string
          p_teacher_id: string
        }
        Returns: boolean
      }
      can_view_curriculum_plan: {
        Args: { p_group_id: string; p_school_id: string }
        Returns: boolean
      }
      check_user_session: {
        Args: { p_session_id: string }
        Returns: string
      }
      claim_demo_slot: {
        Args: {
          p_grade_level?: number
          p_role: string
          p_subject_slug?: string
        }
        Returns: {
          email: string
          password: string
          session_token: string
          user_id: string
          username: string
        }[]
      }
      current_admin_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_parent_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_school_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_student_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_teacher_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      end_session: {
        Args: { p_session_id: string }
        Returns: string
      }
      enforce_max_two_parents_per_student: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_ai_messages_today: {
        Args: { p_student_id: string }
        Returns: number
      }
      fn_announce_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_auto_activate_first_stage: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_auto_end_lessons: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      fn_auto_start_lessons: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      fn_block_past_day_lesson_start: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_class_thread_id: {
        Args: { p_group_id: string }
        Returns: string
      }
      fn_classwork_grade_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_cleanup_expired_announcements: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      fn_clear_demo_on_complete: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_close_other_in_progress_lessons: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_compute_lesson_end: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_create_default_stages: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_email_is_taken: {
        Args: { p_email: string; p_id: string; p_table: string }
        Returns: boolean
      }
      fn_enqueue_homework_ai_review: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_enqueue_lesson_stage_embedding: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_enqueue_quiz_stage_embedding: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_ensure_direct_chat: {
        Args: { p_student_id: string; p_teacher_id: string }
        Returns: undefined
      }
      fn_excuse_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_guard_parent_social_emails: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_h5p_content_set_defaults: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_h5p_content_touch_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_homework_grade_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_homework_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_homework_submission_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_is_admin: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      fn_kahoot_assert_teacher: {
        Args: { p_stage_id: string }
        Returns: undefined
      }
      fn_leave_decision_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_leave_request_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_lesson_day_index: {
        Args: { p_lesson_id: string }
        Returns: number
      }
      fn_lesson_grade_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_lesson_material_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_lesson_materials_to_kb: {
        Args: { p_lesson_id: string }
        Returns: undefined
      }
      fn_lesson_status_to_kb: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_lock_teacher_marks: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_login_is_taken: {
        Args: { p_id: string; p_login: string; p_table: string }
        Returns: boolean
      }
      fn_mark_stage_activated: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_my_subject_slugs: {
        Args: Record<PropertyKey, never>
        Returns: {
          subject_slug: string
        }[]
      }
      fn_no_student_self_grading: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_no_student_stage_self_grading: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_notify_student_grade: {
        Args: {
          p_grade: number
          p_source: string
          p_student_id: string
          p_what: string
        }
        Returns: undefined
      }
      fn_project_grade_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_protect_demo_school: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_sandbox_projects_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_school_subjects_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_set_homework_ai_review_pending: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_stage_grade_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_storage_path_visible: {
        Args: { p_name: string }
        Returns: boolean
      }
      fn_storage_rel: {
        Args: { p_name: string }
        Returns: string
      }
      fn_subjects_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_test_grade_notify: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      fn_validate_lesson_start: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      get_ai_usage_today: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_occupied_teacher_subjects: {
        Args: Record<PropertyKey, never>
        Returns: {
          subject_slug: string
        }[]
      }
      get_quiz_paper: {
        Args: { p_stage_id: string }
        Returns: Json
      }
      get_test_paper: {
        Args: { p_homework_id: string }
        Returns: Json
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      heartbeat_demo_slot: {
        Args: { p_session_token: string }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      increment_ai_usage: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      is_curator_teacher: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_my_child: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      is_my_child_group: {
        Args: { p_group_id: string }
        Returns: boolean
      }
      is_my_child_lesson: {
        Args: { p_lesson_id: string }
        Returns: boolean
      }
      is_my_group: {
        Args: { p_group_id: string }
        Returns: boolean
      }
      is_my_teacher_group: {
        Args: { p_group_id: string }
        Returns: boolean
      }
      is_my_thread: {
        Args: { p_thread_id: string }
        Returns: boolean
      }
      is_school_admin_of: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      is_subject_owner: {
        Args: { p_subject_id: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      journal_assert_no_secrets: {
        Args: { p_details: Json }
        Returns: undefined
      }
      kahoot_finish: {
        Args: { p_stage_id: string }
        Returns: Json
      }
      kahoot_next: {
        Args: { p_stage_id: string }
        Returns: {
          current_question_index: number
          finished_at: string | null
          id: string
          question_started_at: string | null
          school_id: string
          stage_id: string
          started_at: string | null
          status: string
        }
      }
      kahoot_open_session: {
        Args: { p_restart?: boolean; p_stage_id: string }
        Returns: {
          current_question_index: number
          finished_at: string | null
          id: string
          question_started_at: string | null
          school_id: string
          stage_id: string
          started_at: string | null
          status: string
        }
      }
      kahoot_reveal: {
        Args: { p_stage_id: string }
        Returns: {
          current_question_index: number
          finished_at: string | null
          id: string
          question_started_at: string | null
          school_id: string
          stage_id: string
          started_at: string | null
          status: string
        }
      }
      kahoot_start: {
        Args: { p_stage_id: string }
        Returns: {
          current_question_index: number
          finished_at: string | null
          id: string
          question_started_at: string | null
          school_id: string
          stage_id: string
          started_at: string | null
          status: string
        }
      }
      kahoot_state: {
        Args: { p_prefetch?: boolean; p_stage_id: string }
        Returns: Json
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      mark_edit_window: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      match_lesson_stage_embeddings: {
        Args: { p_match_count?: number; p_query_embedding: string }
        Returns: {
          chunk_text: string
          lesson_id: string
          lesson_stage_id: string
          lesson_topic: string
          similarity: number
          starts_at: string
        }[]
      }
      my_sessions: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          id: string
          ip: string
          is_current: boolean
          last_seen_at: string
          user_agent: string
        }[]
      }
      notify_user_and_parents: {
        Args: {
          p_body: string
          p_link: string
          p_source_id: string
          p_student_id: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      rate_limit_hit: {
        Args: {
          p_action: string
          p_limit: number
          p_subject: string
          p_window_seconds: number
        }
        Returns: Json
      }
      rate_limit_sweep: {
        Args: { p_max?: number }
        Returns: number
      }
      release_demo_slot: {
        Args: { p_session_token: string }
        Returns: boolean
      }
      sa_write_allowed: {
        Args: { p_table: string }
        Returns: boolean
      }
      save_quiz_answer: {
        Args: { p_question_id: string; p_selected: number; p_stage_id: string }
        Returns: undefined
      }
      school_is_active: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      school_is_active_for_me: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      set_grading_meta: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      set_lesson_grade_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      start_quiz: {
        Args: { p_stage_id: string }
        Returns: {
          correct_count: number
          finished_at: string | null
          id: string
          is_finalized: boolean
          school_id: string
          stage_id: string
          started_at: string
          student_id: string
          total_questions: number
          total_score: number
        }
      }
      start_test: {
        Args: { p_homework_id: string }
        Returns: {
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          homework_id: string
          id: string
          max_score: number | null
          school_id: string
          score: number | null
          started_at: string | null
          student_id: string
          submitted_at: string
        }
      }
      submit_kahoot_answer: {
        Args: { p_question_id: string; p_selected: number; p_stage_id: string }
        Returns: Json
      }
      submit_quiz: {
        Args: { p_stage_id: string }
        Returns: Json
      }
      submit_test: {
        Args: { p_answers: Json; p_homework_id: string }
        Returns: {
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          homework_id: string
          id: string
          max_score: number | null
          school_id: string
          score: number | null
          started_at: string | null
          student_id: string
          submitted_at: string
        }
      }
      superadmin_journal_write: {
        Args: {
          p_action: string
          p_actor_name?: string
          p_actor_user_id?: string
          p_details?: Json
          p_outcome: string
          p_ref?: number
          p_target_id?: string
          p_target_name?: string
          p_target_type?: string
        }
        Returns: number
      }
      sweep_expired_demo_leases: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      teacher_can_write_lesson: {
        Args: { p_lesson_id: string }
        Returns: boolean
      }
      tg_add_parent_to_group_thread: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      tg_check_login_and_email_unique: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      tg_check_parent_email_unique: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      tg_check_superadmin_email_unique: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      tg_group_created: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      tg_group_curator_changed: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      tg_group_curator_direct_chats: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      tg_student_group_added_direct_chats: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      tg_student_group_chat: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      tg_subject_teacher_chat: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      tg_subject_teacher_direct_chats: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      touch_user_session: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_thread_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      announcement_category:
        "general" | "academic" | "event" | "urgent" | "reminder"
      homework_source: "curriculum" | "teacher"
      payment_kind: "subscription" | "one_time"
      payment_status: "completed" | "pending" | "canceled"
      student_status: "active" | "debtor" | "frozen"
      submission_status: "in_progress" | "submitted" | "checking" | "graded"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      announcement_category: [
        "general",
        "academic",
        "event",
        "urgent",
        "reminder",
      ],
      homework_source: ["curriculum", "teacher"],
      payment_kind: ["subscription", "one_time"],
      payment_status: ["completed", "pending", "canceled"],
      student_status: ["active", "debtor", "frozen"],
      submission_status: ["in_progress", "submitted", "checking", "graded"],
    },
  },
} as const
