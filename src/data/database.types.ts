
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "expenses": {
                  Row: {
                    "amount_minor": number,"category": string,"created_at": string,"currency": string,"deleted_at": string | null,"id": string,"member_id": string | null,"name": string,"spent_on": string,"trip_id": string,"updated_at": string
                  }
                  Insert: {
                    "amount_minor": number,"category": string,"created_at": string,"currency": string,"deleted_at"?: string | null,"id": string,"member_id"?: string | null,"name": string,"spent_on": string,"trip_id": string,"updated_at": string
                  }
                  Update: {
                    "amount_minor"?: number,"category"?: string,"created_at"?: string,"currency"?: string,"deleted_at"?: string | null,"id"?: string,"member_id"?: string | null,"name"?: string,"spent_on"?: string,"trip_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_member_fkey"
      columns: ["trip_id","member_id"]
isOneToOne: false
      referencedRelation: "trip_members"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "expenses_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"flight_segments": {
                  Row: {
                    "arrive_at": string,"arrive_tz": string,"depart_at": string,"depart_tz": string,"direction": string,"flight_number": string | null,"from_iata": string,"id": string,"position": number,"to_iata": string,"trip_id": string
                  }
                  Insert: {
                    "arrive_at": string,"arrive_tz": string,"depart_at": string,"depart_tz": string,"direction": string,"flight_number"?: string | null,"from_iata": string,"id": string,"position": number,"to_iata": string,"trip_id": string
                  }
                  Update: {
                    "arrive_at"?: string,"arrive_tz"?: string,"depart_at"?: string,"depart_tz"?: string,"direction"?: string,"flight_number"?: string | null,"from_iata"?: string,"id"?: string,"position"?: number,"to_iata"?: string,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "flight_segments_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_id": string | null,"created_at": string,"friend_code": string,"id": string,"interests": (string)[],"updated_at": string,"username": string
                  }
                  Insert: {
                    "avatar_id"?: string | null,"created_at"?: string,"friend_code"?: string,"id": string,"interests": (string)[],"updated_at"?: string,"username": string
                  }
                  Update: {
                    "avatar_id"?: string | null,"created_at"?: string,"friend_code"?: string,"id"?: string,"interests"?: (string)[],"updated_at"?: string,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"trip_members": {
                  Row: {
                    "budget_level": string | null,"daily_budget_minor": number,"dietary_notes": string | null,"display_name": string,"id": string,"interests": (string)[],"pace": string | null,"role": string,"trip_id": string,"user_id": string | null
                  }
                  Insert: {
                    "budget_level"?: string | null,"daily_budget_minor": number,"dietary_notes"?: string | null,"display_name": string,"id": string,"interests"?: (string)[],"pace"?: string | null,"role": string,"trip_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "budget_level"?: string | null,"daily_budget_minor"?: number,"dietary_notes"?: string | null,"display_name"?: string,"id"?: string,"interests"?: (string)[],"pace"?: string | null,"role"?: string,"trip_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_members_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_photos": {
                  Row: {
                    "created_at": string,"id": string,"taken_at": string | null,"trip_id": string
                  }
                  Insert: {
                    "created_at": string,"id": string,"taken_at"?: string | null,"trip_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"taken_at"?: string | null,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_photos_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trips": {
                  Row: {
                    "base_currency": string,"budget_updated_at": string,"cover_image_uri": string,"created_at": string,"daily_budget_minor": number,"destination": string,"end_date": string,"id": string,"name": string,"owner_id": string,"start_date": string
                  }
                  Insert: {
                    "base_currency": string,"budget_updated_at": string,"cover_image_uri"?: string,"created_at"?: string,"daily_budget_minor": number,"destination": string,"end_date": string,"id": string,"name": string,"owner_id"?: string,"start_date": string
                  }
                  Update: {
                    "base_currency"?: string,"budget_updated_at"?: string,"cover_image_uri"?: string,"created_at"?: string,"daily_budget_minor"?: number,"destination"?: string,"end_date"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"start_date"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_trip":
{ Args: { "members": Json,"segments": Json,"trip": Json }; Returns: undefined
                           },
"find_profile_by_friend_code":
{ Args: { "code": string }; Returns: {
              "interests": (string)[],"username": string
            }[]
                           },
"set_trip_budget":
{ Args: { "members": Json,"organizer_daily_minor": number,"trip_id": string,"updated_at": string }; Returns: undefined
                           },
"trip_organizer_username":
{ Args: { "trip_id": string }; Returns: string
                           },
"upsert_expense":
{ Args: { "expense": Json }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
