import type { HealthEvent } from '@/lib/health/types';
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      health_events: {
        Row: HealthEvent
        Insert: Pick<HealthEvent,'pet_id'|'kind'|'title'|'event_on'|'status'> & Partial<Omit<HealthEvent,'pet_id'|'kind'|'title'|'event_on'|'status'>>
        Update: Partial<HealthEvent>
        Relationships: [{foreignKeyName:'health_events_pet_id_fkey';columns:['pet_id'];isOneToOne:false;referencedRelation:'pets';referencedColumns:['id']}]
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          household_id: string
          id: string
          pet_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          household_id: string
          id?: string
          pet_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          household_id?: string
          id?: string
          pet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          joined_at: string
          role: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Insert: {
          household_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Update: {
          household_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["household_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      medication_doses: {
        Row: {
          administered_at: string | null
          dose_amount: number | null
          dose_unit: string | null
          id: string
          notes: string | null
          recorded_at: string
          recorded_by: string
          schedule_id: string
          scheduled_for: string
          status: Database["public"]["Enums"]["medication_dose_status"]
        }
        Insert: {
          administered_at?: string | null
          dose_amount?: number | null
          dose_unit?: string | null
          id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by: string
          schedule_id: string
          scheduled_for: string
          status: Database["public"]["Enums"]["medication_dose_status"]
        }
        Update: {
          administered_at?: string | null
          dose_amount?: number | null
          dose_unit?: string | null
          id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string
          schedule_id?: string
          scheduled_for?: string
          status?: Database["public"]["Enums"]["medication_dose_status"]
        }
        Relationships: [
          {
            foreignKeyName: "medication_doses_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "medication_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_schedules: {
        Row: {
          active_from: string
          active_until: string | null
          created_at: string
          created_by: string
          days_of_week: number[]
          id: string
          interval_hours: number | null
          is_active: boolean
          medication_id: string
          schedule_type: Database["public"]["Enums"]["medication_schedule_type"]
          scheduled_time: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          active_from: string
          active_until?: string | null
          created_at?: string
          created_by: string
          days_of_week?: number[]
          id?: string
          interval_hours?: number | null
          is_active?: boolean
          medication_id: string
          schedule_type?: Database["public"]["Enums"]["medication_schedule_type"]
          scheduled_time?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          active_from?: string
          active_until?: string | null
          created_at?: string
          created_by?: string
          days_of_week?: number[]
          id?: string
          interval_hours?: number | null
          is_active?: boolean
          medication_id?: string
          schedule_type?: Database["public"]["Enums"]["medication_schedule_type"]
          scheduled_time?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_schedules_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          created_by: string
          dose_amount: number | null
          dose_unit: string | null
          ends_on: string | null
          id: string
          instructions: string | null
          name: string
          notes: string | null
          pet_id: string
          starts_on: string
          status: Database["public"]["Enums"]["medication_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          dose_amount?: number | null
          dose_unit?: string | null
          ends_on?: string | null
          id?: string
          instructions?: string | null
          name: string
          notes?: string | null
          pet_id: string
          starts_on?: string
          status?: Database["public"]["Enums"]["medication_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          dose_amount?: number | null
          dose_unit?: string | null
          ends_on?: string | null
          id?: string
          instructions?: string | null
          name?: string
          notes?: string | null
          pet_id?: string
          starts_on?: string
          status?: Database["public"]["Enums"]["medication_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          archived_at: string | null
          avatar_url: string | null
          birth_date: string | null
          breed: string | null
          color: string | null
          created_at: string
          created_by: string
          household_id: string
          id: string
          microchip_number: string | null
          name: string
          notes: string | null
          passport_number: string | null
          sex: Database["public"]["Enums"]["pet_sex"]
          species: Database["public"]["Enums"]["pet_species"]
          updated_at: string
          vet_clinic: string | null
          veterinarian: string | null
        }
        Insert: {
          archived_at?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          microchip_number?: string | null
          name: string
          notes?: string | null
          passport_number?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          species?: Database["public"]["Enums"]["pet_species"]
          updated_at?: string
          vet_clinic?: string | null
          veterinarian?: string | null
        }
        Update: {
          archived_at?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          microchip_number?: string | null
          name?: string
          notes?: string | null
          passport_number?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          species?: Database["public"]["Enums"]["pet_species"]
          updated_at?: string
          vet_clinic?: string | null
          veterinarian?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      weight_records: {
        Row: {
          updated_at: string
          updated_by: string | null
          archived_at: string | null
          created_at: string
          created_by: string
          id: string
          measured_at: string
          notes: string | null
          pet_id: string
          weight_kg: number
        }
        Insert: {
          updated_at?: string
          updated_by?: string | null
          archived_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          measured_at?: string
          notes?: string | null
          pet_id: string
          weight_kg: number
        }
        Update: {
          updated_at?: string
          updated_by?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          measured_at?: string
          notes?: string | null
          pet_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_health_followup: {
        Args: {p_source_id:string;p_expected_updated_at:string;p_new_id:string;p_values:Json}
        Returns: string
      }
      revise_medication_schedule: {
        Args: { p_schedule_id: string; p_expected_updated_at: string; p_effective_on: string; p_time: string; p_days: number[] }
        Returns: string
      }
      record_medication_dose: {
        Args: {
          p_administered_at?: string
          p_notes?: string
          p_schedule_id: string
          p_scheduled_for: string
          p_status: Database["public"]["Enums"]["medication_dose_status"]
        }
        Returns: {
          administered_at: string
          already_recorded: boolean
          dose_amount: number
          dose_unit: string
          id: string
          notes: string
          recorded_at: string
          recorded_by: string
          schedule_id: string
          scheduled_for: string
          status: Database["public"]["Enums"]["medication_dose_status"]
        }[]
      }
    }
    Enums: {
      household_role: "owner" | "member" | "viewer"
      medication_dose_status: "given" | "skipped"
      medication_schedule_type: "daily_time" | "interval" | "as_needed"
      medication_status: "active" | "paused" | "completed" | "cancelled"
      pet_sex: "male" | "female" | "unknown"
      pet_species: "dog" | "cat" | "bird" | "rodent" | "reptile" | "other"
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      household_role: ["owner", "member", "viewer"],
      medication_dose_status: ["given", "skipped"],
      medication_schedule_type: ["daily_time", "interval", "as_needed"],
      medication_status: ["active", "paused", "completed", "cancelled"],
      pet_sex: ["male", "female", "unknown"],
      pet_species: ["dog", "cat", "bird", "rodent", "reptile", "other"],
    },
  },
} as const
