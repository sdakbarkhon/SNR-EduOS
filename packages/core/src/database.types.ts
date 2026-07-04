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
          id: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          school_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          school_id?: string
          user_id?: string
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
          lesson_id: string
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
          lesson_id: string
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
          lesson_id?: string
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
        }
        Insert: {
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
          file_size_bytes: number | null
          file_storage_path: string
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
          file_size_bytes?: number | null
          file_storage_path: string
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
          file_size_bytes?: number | null
          file_storage_path?: string
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
          storage_path: string | null
          subject: string | null
          title: string
          type: string | null
          uploaded_by: string | null
        }
        Insert: {
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
          storage_path?: string | null
          subject?: string | null
          title: string
          type?: string | null
          uploaded_by?: string | null
        }
        Update: {
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
            foreignKeyName: "course_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
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
      homework: {
        Row: {
          attachment_filename: string | null
          attachment_size_bytes: number | null
          attachment_storage_path: string | null
          attachments: Json
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          description: string | null
          due_date: string | null
          expected_output: string | null
          group_id: string
          id: string
          lesson_id: string | null
          programming_language: string | null
          school_id: string
          source: Database["public"]["Enums"]["homework_source"]
          starter_code: string | null
          teacher_id: string | null
          test_auto_grade: boolean
          test_duration_seconds: number | null
          tests_attachment_filename: string | null
          tests_attachment_path: string | null
          tests_attachment_size_bytes: number | null
          title: string
        }
        Insert: {
          attachment_filename?: string | null
          attachment_size_bytes?: number | null
          attachment_storage_path?: string | null
          attachments?: Json
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          description?: string | null
          due_date?: string | null
          expected_output?: string | null
          group_id: string
          id?: string
          lesson_id?: string | null
          programming_language?: string | null
          school_id?: string
          source?: Database["public"]["Enums"]["homework_source"]
          starter_code?: string | null
          teacher_id?: string | null
          test_auto_grade?: boolean
          test_duration_seconds?: number | null
          tests_attachment_filename?: string | null
          tests_attachment_path?: string | null
          tests_attachment_size_bytes?: number | null
          title: string
        }
        Update: {
          attachment_filename?: string | null
          attachment_size_bytes?: number | null
          attachment_storage_path?: string | null
          attachments?: Json
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          description?: string | null
          due_date?: string | null
          expected_output?: string | null
          group_id?: string
          id?: string
          lesson_id?: string | null
          programming_language?: string | null
          school_id?: string
          source?: Database["public"]["Enums"]["homework_source"]
          starter_code?: string | null
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
          answer_text: string | null
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
          teacher_comment: string | null
        }
        Insert: {
          answer_text?: string | null
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
          teacher_comment?: string | null
        }
        Update: {
          answer_text?: string | null
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
          created_at: string
          file_original_name: string | null
          file_size_bytes: number | null
          file_storage_path: string
          id: string
          lesson_id: string
          school_id: string
          title: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          created_at?: string
          file_original_name?: string | null
          file_size_bytes?: number | null
          file_storage_path: string
          id?: string
          lesson_id: string
          school_id?: string
          title: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string
          file_original_name?: string | null
          file_size_bytes?: number | null
          file_storage_path?: string
          id?: string
          lesson_id?: string
          school_id?: string
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
          is_completed: boolean
          is_live_active: boolean | null
          lesson_id: string
          live_code: string | null
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
          is_completed?: boolean
          is_live_active?: boolean | null
          lesson_id: string
          live_code?: string | null
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
          is_completed?: boolean
          is_live_active?: boolean | null
          lesson_id?: string
          live_code?: string | null
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
      lessons: {
        Row: {
          active_stage_id: string | null
          created_at: string
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
      messages: {
        Row: {
          body: string
          created_at: string
          group_id: string | null
          id: string
          read_at: string | null
          recipient_student_id: string | null
          school_id: string
          sender_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          group_id?: string | null
          id?: string
          read_at?: string | null
          recipient_student_id?: string | null
          school_id?: string
          sender_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          group_id?: string | null
          id?: string
          read_at?: string | null
          recipient_student_id?: string | null
          school_id?: string
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
          {
            foreignKeyName: "messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
        }
        Insert: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          school_id?: string
          stage_id: string
          student_notes?: string | null
          submission_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          school_id?: string
          stage_id?: string
          student_notes?: string | null
          submission_id?: string
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
      schools: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
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
          color: string
          created_at: string
          group_id: string
          icon: string
          id: string
          name: string
          school_id: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          group_id: string
          icon?: string
          id?: string
          name: string
          school_id?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          group_id?: string
          icon?: string
          id?: string
          name?: string
          school_id?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
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
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string
          id: string
          notification_preferences: Json | null
          phone: string | null
          school_id: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name: string
          id?: string
          notification_preferences?: Json | null
          phone?: string | null
          school_id?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string
          id?: string
          notification_preferences?: Json | null
          phone?: string | null
          school_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_school_id: { Args: never; Returns: string }
      current_student_id: { Args: never; Returns: string }
      current_teacher_id: { Args: never; Returns: string }
      fn_ai_messages_today: { Args: { p_student_id: string }; Returns: number }
      fn_auto_end_lessons: { Args: never; Returns: undefined }
      fn_auto_start_lessons: { Args: never; Returns: undefined }
      fn_cleanup_expired_announcements: { Args: never; Returns: undefined }
      fn_is_admin: { Args: { p_user_id?: string }; Returns: boolean }
      fn_notify_student_grade: {
        Args: {
          p_grade: number
          p_source: string
          p_student_id: string
          p_what: string
        }
        Returns: undefined
      }
      is_my_group: { Args: { p_group_id: string }; Returns: boolean }
      is_my_teacher_group: { Args: { p_group_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      reset_demo_data: { Args: never; Returns: undefined }
    }
    Enums: {
      announcement_category:
        | "general"
        | "academic"
        | "event"
        | "urgent"
        | "reminder"
      content_type: "file" | "test" | "programming"
      homework_source: "curriculum" | "teacher"
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
  public: {
    Enums: {
      announcement_category: [
        "general",
        "academic",
        "event",
        "urgent",
        "reminder",
      ],
      content_type: ["file", "test", "programming"],
      homework_source: ["curriculum", "teacher"],
      payment_kind: ["subscription", "one_time"],
      payment_status: ["completed", "pending", "canceled"],
      student_status: ["active", "debtor", "frozen"],
      submission_status: ["submitted", "checking", "graded"],
    },
  },
} as const
