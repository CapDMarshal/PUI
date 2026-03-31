export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          encrypted_password: string
        }
        Insert: {
          id?: string
          email: string
          encrypted_password: string
        }
        Update: {
          id?: string
          email?: string
          encrypted_password?: string
        }
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          exp: number
          role: 'user' | 'admin'
        }
        Insert: {
          id: string
          created_at?: string
          exp?: number
          role?: 'user' | 'admin'
        }
        Update: {
          id?: string
          created_at?: string
          exp?: number
          role?: 'user' | 'admin'
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      campaigns: {
        Row: {
          id: number
          title: string
          description: string
          start_time: string
          end_time: string
          max_participants: number
          created_at: string
          status: 'upcoming' | 'ongoing' | 'finished'
          report_id: number
          organizer_name: string
          organizer_type: 'personal' | 'organization'
        }
        Insert: {
          id?: number
          title: string
          description: string
          start_time: string
          end_time: string
          max_participants?: number
          created_at?: string
          status?: 'upcoming' | 'ongoing' | 'finished'
          report_id: number
          organizer_name: string
          organizer_type: 'personal' | 'organization'
        }
        Update: {
          id?: number
          title?: string
          description?: string
          start_time?: string
          end_time?: string
          max_participants?: number
          created_at?: string
          status?: 'upcoming' | 'ongoing' | 'finished'
          report_id?: number
          organizer_name?: string
          organizer_type?: 'personal' | 'organization'
        }
      }
      campaign_participants: {
        Row: {
          campaign_id: number
          profile_id: string
          joined_at: string
        }
        Insert: {
          campaign_id: number
          profile_id: string
          joined_at?: string
        }
        Update: {
          campaign_id?: number
          profile_id?: string
          joined_at?: string
        }
      }
      reports: {
        Row: {
          id: number
          user_id: string
          image_urls: string[]
          created_at: string
          waste_type: 'organik' | 'anorganik' | 'campuran'
          waste_volume: string
          location_category: string
          hazard_risk: 'tidak_ada' | 'rendah' | 'menengah' | 'tinggi'
          notes: string | null
          location: string // PostGIS geography type (returned as GeoJSON or WKT string)
          status: 'pending' | 'approved' | 'rejected' | 'hazardous'
          reviewed_by: string | null
          reviewed_at: string | null
          admin_notes: string | null
        }
        Insert: {
          id?: number
          user_id: string
          image_urls: string[]
          created_at?: string
          waste_type: 'organik' | 'anorganik' | 'campuran'
          waste_volume: string
          location_category: string
          hazard_risk?: 'tidak_ada' | 'rendah' | 'menengah' | 'tinggi' // defaults to 'tidak_ada'
          notes?: string | null
          location: string // PostGIS geography type
          status?: 'pending' | 'approved' | 'rejected' | 'hazardous'
          reviewed_by?: string | null
          reviewed_at?: string | null
          admin_notes?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          image_urls?: string[]
          created_at?: string
          waste_type?: 'organik' | 'anorganik' | 'campuran'
          waste_volume?: string
          location_category?: string
          hazard_risk?: 'tidak_ada' | 'rendah' | 'menengah' | 'tinggi'
          notes?: string | null
          location?: string // PostGIS geography type
          status?: 'pending' | 'approved' | 'rejected' | 'hazardous'
          reviewed_by?: string | null
          reviewed_at?: string | null
          admin_notes?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_reports_with_coordinates: {
        Args: Record<string, never>
        Returns: {
          id: number
          user_id: string
          image_urls: string[]
          created_at: string
          waste_type: 'organik' | 'anorganik' | 'campuran'
          waste_volume: string
          location_category: string
          hazard_risk: 'tidak_ada' | 'rendah' | 'menengah' | 'tinggi'
          notes: string | null
          status: 'pending' | 'approved' | 'rejected' | 'hazardous'
          latitude: number
          longitude: number
        }[]
      }
      get_province_statistics: {
        Args: {
          limit_count?: number
        }
        Returns: {
          province_name: string
          report_count: number
          organic_count: number
          inorganic_count: number
          mixed_count: number
          high_risk_count: number
          avg_latitude: number
          avg_longitude: number
        }[]
      }
      get_city_statistics: {
        Args: {
          limit_count?: number
        }
        Returns: {
          rank: number
          city: string
          province: string
          score: number
          completed_campaigns: number
          active_reports: number
          cleaned_areas: number
        }[]
      }
      get_overall_statistics: {
        Args: Record<string, never>
        Returns: {
          total_campaigns_completed: number
          total_participants: number
          total_cleaned_areas: number
        }
      }
      get_waste_type_statistics: {
        Args: Record<string, never>
        Returns: {
          total: number
          organic: number
          inorganic: number
          mixed: number
          risk_none: number
          risk_low: number
          risk_medium: number
          risk_high: number
        }
      }
      get_user_reports_with_coordinates: {
        Args: { p_user_id: string }
        Returns: {
          id: number
          user_id: string
          image_urls: string[]
          created_at: string
          waste_type: 'organik' | 'anorganik' | 'campuran'
          waste_volume: string
          location_category: string
          hazard_risk: 'tidak_ada' | 'rendah' | 'menengah' | 'tinggi'
          notes: string | null
          status: 'pending' | 'approved' | 'rejected' | 'hazardous'
          admin_notes: string | null
          latitude: number
          longitude: number
        }[]
      }
      get_pending_reports: {
        Args: Record<string, never>
        Returns: {
          id: number
          user_id: string
          image_urls: string[]
          created_at: string
          waste_type: 'organik' | 'anorganik' | 'campuran'
          waste_volume: string
          location_category: string
          hazard_risk: 'tidak_ada' | 'rendah' | 'menengah' | 'tinggi'
          notes: string | null
          status: 'pending' | 'approved' | 'rejected' | 'hazardous'
          latitude: number
          longitude: number
        }[]
      }
      get_admin_statistics: {
        Args: Record<string, never>
        Returns: {
          pending_count: number
          approved_count: number
          rejected_count: number
          hazardous_count: number
          total_count: number
        }[]
      }
    }
    Enums: {
      location_category_enum: 'sungai' | 'pinggir_jalan' | 'area_publik' | 'tanah_kosong' | 'lainnya'
      waste_type_enum: 'organik' | 'anorganik' | 'campuran'
      waste_volume_enum: 'kurang_dari_1kg' | '1_5kg' | '6_10kg' | 'lebih_dari_10kg'
      hazard_risk_enum: 'tidak_ada' | 'rendah' | 'menengah' | 'tinggi'
      campaign_status_enum: 'upcoming' | 'ongoing' | 'finished'
      campaign_organizer_type_enum: 'personal' | 'organization'
      report_status_enum: 'pending' | 'approved' | 'rejected' | 'hazardous'
      role_enum: 'user' | 'admin'
    }
  }
}
