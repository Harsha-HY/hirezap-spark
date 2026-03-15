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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          ai_analysis: Json | null
          applied_at: string
          candidate_id: string
          code_answers: Json | null
          cover_letter: string | null
          current_company: string
          current_ctc: number
          current_stage: string
          expected_ctc: number
          experience_years: number
          id: string
          interview_score: number | null
          job_id: string
          notice_period: number
          overall_score: number | null
          photo_url: string | null
          resume_score: number | null
          resume_url: string | null
          status: string
          technical_score: number | null
          test_score: number | null
          updated_at: string
          video_analysis: Json | null
          video_score: number | null
          video_url: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          applied_at?: string
          candidate_id: string
          code_answers?: Json | null
          cover_letter?: string | null
          current_company: string
          current_ctc: number
          current_stage?: string
          expected_ctc: number
          experience_years: number
          id?: string
          interview_score?: number | null
          job_id: string
          notice_period: number
          overall_score?: number | null
          photo_url?: string | null
          resume_score?: number | null
          resume_url?: string | null
          status?: string
          technical_score?: number | null
          test_score?: number | null
          updated_at?: string
          video_analysis?: Json | null
          video_score?: number | null
          video_url?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          applied_at?: string
          candidate_id?: string
          code_answers?: Json | null
          cover_letter?: string | null
          current_company?: string
          current_ctc?: number
          current_stage?: string
          expected_ctc?: number
          experience_years?: number
          id?: string
          interview_score?: number | null
          job_id?: string
          notice_period?: number
          overall_score?: number | null
          photo_url?: string | null
          resume_score?: number | null
          resume_url?: string | null
          status?: string
          technical_score?: number | null
          test_score?: number | null
          updated_at?: string
          video_analysis?: Json | null
          video_score?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          application_id: string
          approved_at: string | null
          company_id: string
          created_at: string
          created_by: string
          hr_approved: boolean
          hr_approved_at: string | null
          id: string
          job_id: string
          manager_approved: boolean
          manager_approved_at: string | null
          questions: Json
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          application_id: string
          approved_at?: string | null
          company_id: string
          created_at?: string
          created_by: string
          hr_approved?: boolean
          hr_approved_at?: string | null
          id?: string
          job_id: string
          manager_approved?: boolean
          manager_approved_at?: string | null
          questions?: Json
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          approved_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          hr_approved?: boolean
          hr_approved_at?: string | null
          id?: string
          job_id?: string
          manager_approved?: boolean
          manager_approved_at?: string | null
          questions?: Json
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      bgv_documents: {
        Row: {
          application_id: string
          candidate_id: string
          created_at: string
          document_type: string
          file_url: string
          id: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          application_id: string
          candidate_id: string
          created_at?: string
          document_type: string
          file_url: string
          id?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          application_id?: string
          candidate_id?: string
          created_at?: string
          document_type?: string
          file_url?: string
          id?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bgv_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          company_code: string
          company_name: string
          created_at: string
          id: string
          industry: string
          location: string
          owner_id: string
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          company_code: string
          company_name: string
          created_at?: string
          id?: string
          industry?: string
          location: string
          owner_id: string
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_code?: string
          company_name?: string
          created_at?: string
          id?: string
          industry?: string
          location?: string
          owner_id?: string
          plan?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      gd_groups: {
        Row: {
          candidate_ids: string[]
          created_at: string
          gd_id: string
          group_name: string
          id: string
        }
        Insert: {
          candidate_ids?: string[]
          created_at?: string
          gd_id: string
          group_name: string
          id?: string
        }
        Update: {
          candidate_ids?: string[]
          created_at?: string
          gd_id?: string
          group_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gd_groups_gd_id_fkey"
            columns: ["gd_id"]
            isOneToOne: false
            referencedRelation: "group_discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_scores: {
        Row: {
          ai_feedback: string | null
          candidate_id: string
          communication_score: number | null
          created_at: string
          gd_id: string
          group_id: string | null
          id: string
          leadership_score: number | null
          overall_gd_score: number | null
          points_quality: number | null
          relevance_score: number | null
          speaking_percentage: number | null
          speaking_time_minutes: number | null
          times_spoke: number | null
          verdict: string | null
        }
        Insert: {
          ai_feedback?: string | null
          candidate_id: string
          communication_score?: number | null
          created_at?: string
          gd_id: string
          group_id?: string | null
          id?: string
          leadership_score?: number | null
          overall_gd_score?: number | null
          points_quality?: number | null
          relevance_score?: number | null
          speaking_percentage?: number | null
          speaking_time_minutes?: number | null
          times_spoke?: number | null
          verdict?: string | null
        }
        Update: {
          ai_feedback?: string | null
          candidate_id?: string
          communication_score?: number | null
          created_at?: string
          gd_id?: string
          group_id?: string | null
          id?: string
          leadership_score?: number | null
          overall_gd_score?: number | null
          points_quality?: number | null
          relevance_score?: number | null
          speaking_percentage?: number | null
          speaking_time_minutes?: number | null
          times_spoke?: number | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_scores_gd_id_fkey"
            columns: ["gd_id"]
            isOneToOne: false
            referencedRelation: "group_discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_scores_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "gd_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_discussions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          duration: number
          id: string
          instructions: string | null
          job_id: string
          meeting_link: string | null
          scheduled_date: string
          scheduled_time: string
          status: string
          topic: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          duration?: number
          id?: string
          instructions?: string | null
          job_id: string
          meeting_link?: string | null
          scheduled_date: string
          scheduled_time: string
          status?: string
          topic: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          duration?: number
          id?: string
          instructions?: string | null
          job_id?: string
          meeting_link?: string | null
          scheduled_date?: string
          scheduled_time?: string
          status?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_discussions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_discussions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          application_id: string
          candidate_id: string
          company_id: string
          created_at: string
          duration: number
          id: string
          interviewer_id: string
          interviewer_name: string
          job_id: string
          meeting_link: string | null
          mode: string
          notes: string | null
          recommendation: string | null
          round_type: string
          scheduled_date: string
          scheduled_time: string
          scorecard: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          candidate_id: string
          company_id: string
          created_at?: string
          duration?: number
          id?: string
          interviewer_id: string
          interviewer_name: string
          job_id: string
          meeting_link?: string | null
          mode?: string
          notes?: string | null
          recommendation?: string | null
          round_type?: string
          scheduled_date: string
          scheduled_time: string
          scorecard?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          candidate_id?: string
          company_id?: string
          created_at?: string
          duration?: number
          id?: string
          interviewer_id?: string
          interviewer_name?: string
          job_id?: string
          meeting_link?: string | null
          mode?: string
          notes?: string | null
          recommendation?: string | null
          round_type?: string
          scheduled_date?: string
          scheduled_time?: string
          scorecard?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          applications_count: number
          aptitude_cutoff: number | null
          aptitude_questions: Json | null
          company_id: string
          created_at: string
          department: string
          experience_max: number | null
          experience_min: number | null
          id: string
          job_description: string | null
          location: string
          manager_id: string | null
          posted_by: string
          salary_max: number | null
          salary_min: number | null
          skills_required: string[] | null
          status: string
          title: string
          updated_at: string
          work_type: string
        }
        Insert: {
          applications_count?: number
          aptitude_cutoff?: number | null
          aptitude_questions?: Json | null
          company_id: string
          created_at?: string
          department: string
          experience_max?: number | null
          experience_min?: number | null
          id?: string
          job_description?: string | null
          location: string
          manager_id?: string | null
          posted_by: string
          salary_max?: number | null
          salary_min?: number | null
          skills_required?: string[] | null
          status?: string
          title: string
          updated_at?: string
          work_type?: string
        }
        Update: {
          applications_count?: number
          aptitude_cutoff?: number | null
          aptitude_questions?: Json | null
          company_id?: string
          created_at?: string
          department?: string
          experience_max?: number | null
          experience_min?: number | null
          id?: string
          job_description?: string | null
          location?: string
          manager_id?: string | null
          posted_by?: string
          salary_max?: number | null
          salary_min?: number | null
          skills_required?: string[] | null
          status?: string
          title?: string
          updated_at?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          offer_id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          offer_id: string
          sender_id: string
          sender_role: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          offer_id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_messages_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offer_letters"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_letters: {
        Row: {
          accept_by: string
          accepted_at: string | null
          application_id: string
          basic_salary: number
          candidate_id: string
          company_id: string
          created_at: string
          ctc_total: number
          decline_reason: string | null
          department: string
          designation: string
          esops: number | null
          hra: number
          id: string
          job_id: string
          joining_date: string
          other_allowances: number
          performance_bonus: number
          probation_period: string
          status: string
          updated_at: string
          work_location: string
          work_type: string
        }
        Insert: {
          accept_by: string
          accepted_at?: string | null
          application_id: string
          basic_salary?: number
          candidate_id: string
          company_id: string
          created_at?: string
          ctc_total: number
          decline_reason?: string | null
          department: string
          designation: string
          esops?: number | null
          hra?: number
          id?: string
          job_id: string
          joining_date: string
          other_allowances?: number
          performance_bonus?: number
          probation_period?: string
          status?: string
          updated_at?: string
          work_location: string
          work_type?: string
        }
        Update: {
          accept_by?: string
          accepted_at?: string | null
          application_id?: string
          basic_salary?: number
          candidate_id?: string
          company_id?: string
          created_at?: string
          ctc_total?: number
          decline_reason?: string | null
          department?: string
          designation?: string
          esops?: number | null
          hra?: number
          id?: string
          job_id?: string
          joining_date?: string
          other_allowances?: number
          performance_bonus?: number
          probation_period?: string
          status?: string
          updated_at?: string
          work_location?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_letters_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_letters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_letters_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_answers: {
        Row: {
          application_id: string
          created_at: string
          id: string
          question_index: number
          selected_option: number | null
          time_spent_seconds: number | null
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          question_index: number
          selected_option?: number | null
          time_spent_seconds?: number | null
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          question_index?: number
          selected_option?: number | null
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      test_violations: {
        Row: {
          application_id: string
          candidate_id: string
          created_at: string
          description: string
          id: string
          job_id: string
          question_number: number | null
          violation_type: string
        }
        Insert: {
          application_id: string
          candidate_id: string
          created_at?: string
          description: string
          id?: string
          job_id: string
          question_number?: number | null
          violation_type: string
        }
        Update: {
          application_id?: string
          candidate_id?: string
          created_at?: string
          description?: string
          id?: string
          job_id?: string
          question_number?: number | null
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_violations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          company_id: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_candidate_in_gd: { Args: { p_gd_id: string }; Returns: boolean }
      is_staff_for_gd: { Args: { p_gd_id: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
