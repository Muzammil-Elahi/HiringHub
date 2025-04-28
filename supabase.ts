export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      applications: {
        Row: {
          application_date: string
          cover_letter: string | null
          id: string
          job_id: string
          job_seeker_id: string
          resume_snapshot_url: string | null
          status: string
        }
        Insert: {
          application_date?: string
          cover_letter?: string | null
          id?: string
          job_id: string
          job_seeker_id: string
          resume_snapshot_url?: string | null
          status?: string
        }
        Update: {
          application_date?: string
          cover_letter?: string | null
          id?: string
          job_id?: string
          job_seeker_id?: string
          resume_snapshot_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_seeker"
            columns: ["job_seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      job_skills: {
        Row: {
          is_required: boolean
          job_id: string
          skill_id: number
          skill_name: string | null
        }
        Insert: {
          is_required?: boolean
          job_id: string
          skill_id: number
          skill_name?: string | null
        }
        Update: {
          is_required?: boolean
          job_id?: string
          skill_id?: number
          skill_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_skills_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          company_name: string | null
          created_at: string
          description: string
          hiring_manager_id: string
          id: string
          is_active: boolean
          job_type: string | null
          location: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          title: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          description: string
          hiring_manager_id: string
          id?: string
          is_active?: boolean
          job_type?: string | null
          location?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          description?: string
          hiring_manager_id?: string
          id?: string
          is_active?: boolean
          job_type?: string | null
          location?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_skills: {
        Row: {
          proficiency: number | null
          profile_user_id: string
          skill_id: number
        }
        Insert: {
          proficiency?: number | null
          profile_user_id: string
          skill_id: number
        }
        Update: {
          proficiency?: number | null
          profile_user_id?: string
          skill_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_profile_user_id_fkey"
            columns: ["profile_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          bio: string | null
          company_name: string | null
          company_website: string | null
          created_at: string
          full_name: string | null
          headline: string | null
          linkedin_url: string | null
          location: string | null
          resume_filename: string | null
          resume_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: string
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          company_website?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          linkedin_url?: string | null
          location?: string | null
          resume_filename?: string | null
          resume_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          company_name?: string | null
          company_website?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          linkedin_url?: string | null
          location?: string | null
          resume_filename?: string | null
          resume_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          category: string | null
          id: number
          name: string
        }
        Insert: {
          category?: string | null
          id?: number
          name: string
        }
        Update: {
          category?: string | null
          id?: number
          name?: string
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
      remote_preference: "remote" | "onsite" | "hybrid" | "flexible"
      skill_proficiency: "beginner" | "intermediate" | "expert"
      user_type: "job_seeker" | "hiring_manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      remote_preference: ["remote", "onsite", "hybrid", "flexible"],
      skill_proficiency: ["beginner", "intermediate", "expert"],
      user_type: ["job_seeker", "hiring_manager"],
    },
  },
} as const
