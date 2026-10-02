// Generated from the live Supabase schema — do not edit by hand.
// Regenerate after a migration: npm run gen:types (needs `supabase link`)
// (or the Supabase MCP / dashboard "Generate types" action).

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
      ad_spend: {
        Row: {
          amount: number
          created_at: string
          deleted: boolean
          id: string
          month: string
          notes: string | null
          org_id: string | null
          synced_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          deleted?: boolean
          id: string
          month: string
          notes?: string | null
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          deleted?: boolean
          id?: string
          month?: string
          notes?: string | null
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_spend_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      base_coat_colors: {
        Row: {
          created_at: string
          deleted: boolean
          id: string
          name: string
          org_id: string | null
          synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          id: string
          name: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_coat_colors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      basecoat_inventory: {
        Row: {
          base_a: number
          base_b_clear: number | null
          base_b_grey: number
          base_b_tan: number
          deleted: boolean
          id: string
          org_id: string | null
          synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_a: number
          base_b_clear?: number | null
          base_b_grey: number
          base_b_tan: number
          deleted?: boolean
          id: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_a?: number
          base_b_clear?: number | null
          base_b_grey?: number
          base_b_tan?: number
          deleted?: boolean
          id?: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "basecoat_inventory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_blends: {
        Row: {
          base_coat_color_ids: Json | null
          created_at: string
          deleted: boolean
          id: string
          name: string
          org_id: string | null
          synced_at: string | null
          system_ids: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_coat_color_ids?: Json | null
          created_at?: string
          deleted?: boolean
          id: string
          name: string
          org_id?: string | null
          synced_at?: string | null
          system_ids?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_coat_color_ids?: Json | null
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          org_id?: string | null
          synced_at?: string | null
          system_ids?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chip_blends_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_inventory: {
        Row: {
          blend: string
          deleted: boolean
          id: string
          org_id: string | null
          pounds: number
          synced_at: string | null
          system_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blend: string
          deleted?: boolean
          id: string
          org_id?: string | null
          pounds: number
          synced_at?: string | null
          system_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blend?: string
          deleted?: boolean
          id?: string
          org_id?: string | null
          pounds?: number
          synced_at?: string | null
          system_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chip_inventory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coating_inventory: {
        Row: {
          color: string | null
          deleted: boolean
          gallons: number
          id: string
          org_id: string | null
          part: string
          sort_order: number | null
          synced_at: string | null
          updated_at: string
          user_id: string | null
          variant: string | null
        }
        Insert: {
          color?: string | null
          deleted?: boolean
          gallons?: number
          id: string
          org_id?: string | null
          part: string
          sort_order?: number | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
          variant?: string | null
        }
        Update: {
          color?: string | null
          deleted?: boolean
          gallons?: number
          id?: string
          org_id?: string | null
          part?: string
          sort_order?: number | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coating_inventory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_templates: {
        Row: {
          body: string
          created_at: string | null
          deleted: boolean | null
          id: string
          name: string
          org_id: string | null
          synced_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          deleted?: boolean | null
          id: string
          name: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          deleted?: boolean | null
          id?: string
          name?: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      costs: {
        Row: {
          abrasion_resistance_cost_per_gal: number
          anti_slip_cost_per_gal: number
          base_cost_per_gal: number
          consumables_cost: number
          crack_fill_cost: number
          created_at: string
          cyclo1_cost_per_gal: number | null
          deleted: boolean
          gas_cost: number
          id: string
          moisture_mitigation_cost_per_gal: number | null
          moisture_mitigation_spread_rate: number | null
          org_id: string | null
          shipping_factor: number | null
          synced_at: string | null
          tint_cost_per_quart: number
          top_cost_per_gal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          abrasion_resistance_cost_per_gal?: number
          anti_slip_cost_per_gal?: number
          base_cost_per_gal: number
          consumables_cost: number
          crack_fill_cost: number
          created_at?: string
          cyclo1_cost_per_gal?: number | null
          deleted?: boolean
          gas_cost: number
          id: string
          moisture_mitigation_cost_per_gal?: number | null
          moisture_mitigation_spread_rate?: number | null
          org_id?: string | null
          shipping_factor?: number | null
          synced_at?: string | null
          tint_cost_per_quart: number
          top_cost_per_gal: number
          updated_at?: string
          user_id: string
        }
        Update: {
          abrasion_resistance_cost_per_gal?: number
          anti_slip_cost_per_gal?: number
          base_cost_per_gal?: number
          consumables_cost?: number
          crack_fill_cost?: number
          created_at?: string
          cyclo1_cost_per_gal?: number | null
          deleted?: boolean
          gas_cost?: number
          id?: string
          moisture_mitigation_cost_per_gal?: number | null
          moisture_mitigation_spread_rate?: number | null
          org_id?: string | null
          shipping_factor?: number | null
          synced_at?: string | null
          tint_cost_per_quart?: number
          top_cost_per_gal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "costs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          address_parse_tier: string | null
          address_verified_at: string | null
          city: string | null
          created_at: string
          deleted: boolean
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string | null
          phone: string | null
          state: string | null
          street: string | null
          street2: string | null
          synced_at: string | null
          updated_at: string
          user_id: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          address_parse_tier?: string | null
          address_verified_at?: string | null
          city?: string | null
          created_at?: string
          deleted?: boolean
          email?: string | null
          id: string
          name: string
          notes?: string | null
          org_id?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          street2?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          address_parse_tier?: string | null
          address_verified_at?: string | null
          city?: string | null
          created_at?: string
          deleted?: boolean
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          street2?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_webhook_events: {
        Row: {
          created_at: string
          dedupe_key: string
          error_message: string | null
          event_type: string
          id: string
          org_id: string | null
          processed_at: string | null
          processing_status: string
          raw_payload: Json
          received_at: string
          source_workflow: string | null
          updated_at: string
          user_id: string | null
          webhook_source_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          error_message?: string | null
          event_type: string
          id?: string
          org_id?: string | null
          processed_at?: string | null
          processing_status?: string
          raw_payload: Json
          received_at?: string
          source_workflow?: string | null
          updated_at?: string
          user_id?: string | null
          webhook_source_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          error_message?: string | null
          event_type?: string
          id?: string
          org_id?: string | null
          processed_at?: string | null
          processing_status?: string
          raw_payload?: Json
          received_at?: string
          source_workflow?: string | null
          updated_at?: string
          user_id?: string | null
          webhook_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_webhook_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_webhook_events_webhook_source_id_fkey"
            columns: ["webhook_source_id"]
            isOneToOne: false
            referencedRelation: "ghl_webhook_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_webhook_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string | null
          secret_hash: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id?: string | null
          secret_hash: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          secret_hash?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ghl_webhook_sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          abrasion_resistance: boolean | null
          actual_abrasion_resistance_price: number | null
          actual_anti_slip_price: number | null
          actual_base_coat_gallons: number | null
          actual_chip_boxes: number | null
          actual_coating_removal_price: number | null
          actual_crack_price: number | null
          actual_crack_repair_oz: number | null
          actual_cyclo1_gallons: number | null
          actual_discount: number | null
          actual_expense_adjustment: number | null
          actual_expense_adjustment_notes: string | null
          actual_floor_price: number | null
          actual_floor_price_per_sqft: number | null
          actual_install_schedule: Json | null
          actual_moisture_mitigation_gallons: number | null
          actual_moisture_mitigation_price: number | null
          actual_slab_temp: number | null
          actual_tint_oz: number | null
          actual_top_coat_gallons: number | null
          actual_vertical_price: number | null
          actual_vertical_price_per_sqft: number | null
          address_parse_tier: string | null
          address_verified_at: string | null
          anti_slip: boolean | null
          base_color: string | null
          chip_blend: string | null
          coating_removal: string | null
          costs_snapshot: Json
          crack_fill_factor: number
          created_at: string
          customer_address: string | null
          customer_city: string | null
          customer_name: string | null
          customer_state: string | null
          customer_street: string | null
          customer_street2: string | null
          customer_zip: string | null
          cyclo1_coats: number | null
          cyclo1_topcoat: boolean | null
          decision_date: string | null
          deleted: boolean
          disable_gas_heater: boolean | null
          estimate_date: string | null
          evaluation: Json | null
          floor_footage: number
          follow_ups: Json | null
          google_drive_folder_id: string | null
          group_id: string | null
          group_type: string | null
          id: string
          include_basecoat_tint: boolean | null
          include_topcoat_tint: boolean | null
          install_date: string
          install_days: number
          install_schedule: Json | null
          inventory_actuals_applied: Json | null
          is_primary_estimate: boolean | null
          job_hours: number
          laborers_snapshot: Json
          lead_id: string | null
          material_allocation: Json | null
          moisture_mitigation: boolean | null
          name: string
          notes: string | null
          org_id: string | null
          photos: Json | null
          pricing_snapshot: Json | null
          probability: number | null
          products: Json | null
          reminders: Json | null
          status: string
          synced: boolean
          synced_at: string | null
          system_id: string
          system_snapshot: Json
          tags: string[] | null
          tint_color: string | null
          total_price: number
          travel_distance: number
          updated_at: string
          user_id: string
          vertical_footage: number
        }
        Insert: {
          abrasion_resistance?: boolean | null
          actual_abrasion_resistance_price?: number | null
          actual_anti_slip_price?: number | null
          actual_base_coat_gallons?: number | null
          actual_chip_boxes?: number | null
          actual_coating_removal_price?: number | null
          actual_crack_price?: number | null
          actual_crack_repair_oz?: number | null
          actual_cyclo1_gallons?: number | null
          actual_discount?: number | null
          actual_expense_adjustment?: number | null
          actual_expense_adjustment_notes?: string | null
          actual_floor_price?: number | null
          actual_floor_price_per_sqft?: number | null
          actual_install_schedule?: Json | null
          actual_moisture_mitigation_gallons?: number | null
          actual_moisture_mitigation_price?: number | null
          actual_slab_temp?: number | null
          actual_tint_oz?: number | null
          actual_top_coat_gallons?: number | null
          actual_vertical_price?: number | null
          actual_vertical_price_per_sqft?: number | null
          address_parse_tier?: string | null
          address_verified_at?: string | null
          anti_slip?: boolean | null
          base_color?: string | null
          chip_blend?: string | null
          coating_removal?: string | null
          costs_snapshot: Json
          crack_fill_factor: number
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_name?: string | null
          customer_state?: string | null
          customer_street?: string | null
          customer_street2?: string | null
          customer_zip?: string | null
          cyclo1_coats?: number | null
          cyclo1_topcoat?: boolean | null
          decision_date?: string | null
          deleted?: boolean
          disable_gas_heater?: boolean | null
          estimate_date?: string | null
          evaluation?: Json | null
          floor_footage: number
          follow_ups?: Json | null
          google_drive_folder_id?: string | null
          group_id?: string | null
          group_type?: string | null
          id: string
          include_basecoat_tint?: boolean | null
          include_topcoat_tint?: boolean | null
          install_date: string
          install_days: number
          install_schedule?: Json | null
          inventory_actuals_applied?: Json | null
          is_primary_estimate?: boolean | null
          job_hours: number
          laborers_snapshot: Json
          lead_id?: string | null
          material_allocation?: Json | null
          moisture_mitigation?: boolean | null
          name: string
          notes?: string | null
          org_id?: string | null
          photos?: Json | null
          pricing_snapshot?: Json | null
          probability?: number | null
          products?: Json | null
          reminders?: Json | null
          status: string
          synced?: boolean
          synced_at?: string | null
          system_id: string
          system_snapshot: Json
          tags?: string[] | null
          tint_color?: string | null
          total_price: number
          travel_distance: number
          updated_at?: string
          user_id: string
          vertical_footage: number
        }
        Update: {
          abrasion_resistance?: boolean | null
          actual_abrasion_resistance_price?: number | null
          actual_anti_slip_price?: number | null
          actual_base_coat_gallons?: number | null
          actual_chip_boxes?: number | null
          actual_coating_removal_price?: number | null
          actual_crack_price?: number | null
          actual_crack_repair_oz?: number | null
          actual_cyclo1_gallons?: number | null
          actual_discount?: number | null
          actual_expense_adjustment?: number | null
          actual_expense_adjustment_notes?: string | null
          actual_floor_price?: number | null
          actual_floor_price_per_sqft?: number | null
          actual_install_schedule?: Json | null
          actual_moisture_mitigation_gallons?: number | null
          actual_moisture_mitigation_price?: number | null
          actual_slab_temp?: number | null
          actual_tint_oz?: number | null
          actual_top_coat_gallons?: number | null
          actual_vertical_price?: number | null
          actual_vertical_price_per_sqft?: number | null
          address_parse_tier?: string | null
          address_verified_at?: string | null
          anti_slip?: boolean | null
          base_color?: string | null
          chip_blend?: string | null
          coating_removal?: string | null
          costs_snapshot?: Json
          crack_fill_factor?: number
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_name?: string | null
          customer_state?: string | null
          customer_street?: string | null
          customer_street2?: string | null
          customer_zip?: string | null
          cyclo1_coats?: number | null
          cyclo1_topcoat?: boolean | null
          decision_date?: string | null
          deleted?: boolean
          disable_gas_heater?: boolean | null
          estimate_date?: string | null
          evaluation?: Json | null
          floor_footage?: number
          follow_ups?: Json | null
          google_drive_folder_id?: string | null
          group_id?: string | null
          group_type?: string | null
          id?: string
          include_basecoat_tint?: boolean | null
          include_topcoat_tint?: boolean | null
          install_date?: string
          install_days?: number
          install_schedule?: Json | null
          inventory_actuals_applied?: Json | null
          is_primary_estimate?: boolean | null
          job_hours?: number
          laborers_snapshot?: Json
          lead_id?: string | null
          material_allocation?: Json | null
          moisture_mitigation?: boolean | null
          name?: string
          notes?: string | null
          org_id?: string | null
          photos?: Json | null
          pricing_snapshot?: Json | null
          probability?: number | null
          products?: Json | null
          reminders?: Json | null
          status?: string
          synced?: boolean
          synced_at?: string | null
          system_id?: string
          system_snapshot?: Json
          tags?: string[] | null
          tint_color?: string | null
          total_price?: number
          travel_distance?: number
          updated_at?: string
          user_id?: string
          vertical_footage?: number
        }
        Relationships: [
          {
            foreignKeyName: "jobs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      laborers: {
        Row: {
          created_at: string
          deleted: boolean
          fully_loaded_rate: number
          id: string
          is_active: boolean
          name: string
          org_id: string | null
          synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          fully_loaded_rate: number
          id: string
          is_active?: boolean
          name: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted?: boolean
          fully_loaded_rate?: number
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laborers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_appointments: {
        Row: {
          assigned_user: string | null
          calendar_name: string | null
          created_at: string
          created_from_event_id: string | null
          deleted: boolean
          ghl_appointment_id: string | null
          id: string
          last_event_id: string | null
          lead_id: string
          org_id: string | null
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          status: string
          synced_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_user?: string | null
          calendar_name?: string | null
          created_at?: string
          created_from_event_id?: string | null
          deleted?: boolean
          ghl_appointment_id?: string | null
          id: string
          last_event_id?: string | null
          lead_id: string
          org_id?: string | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          status?: string
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_user?: string | null
          calendar_name?: string | null
          created_at?: string
          created_from_event_id?: string | null
          deleted?: boolean
          ghl_appointment_id?: string | null
          id?: string
          last_event_id?: string | null
          lead_id?: string
          org_id?: string | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          status?: string
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_appointments_created_from_event_id_fkey"
            columns: ["created_from_event_id"]
            isOneToOne: false
            referencedRelation: "ghl_webhook_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_appointments_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "ghl_webhook_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_appointments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          address_parse_tier: string | null
          address_verified_at: string | null
          campaign: string | null
          city: string | null
          closed_at: string | null
          created_at: string
          customer_id: string | null
          deleted: boolean
          disposition_notes: string | null
          disposition_reason: string | null
          email: string | null
          first_seen_at: string
          ghl_contact_id: string | null
          id: string
          last_event_at: string | null
          name: string | null
          org_id: string | null
          phone: string | null
          source: string | null
          stage: string
          state: string | null
          street: string | null
          street2: string | null
          synced_at: string | null
          updated_at: string
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          address_parse_tier?: string | null
          address_verified_at?: string | null
          campaign?: string | null
          city?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          deleted?: boolean
          disposition_notes?: string | null
          disposition_reason?: string | null
          email?: string | null
          first_seen_at?: string
          ghl_contact_id?: string | null
          id: string
          last_event_at?: string | null
          name?: string | null
          org_id?: string | null
          phone?: string | null
          source?: string | null
          stage?: string
          state?: string | null
          street?: string | null
          street2?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          address_parse_tier?: string | null
          address_verified_at?: string | null
          campaign?: string | null
          city?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          deleted?: boolean
          disposition_notes?: string | null
          disposition_reason?: string | null
          email?: string | null
          first_seen_at?: string
          ghl_contact_id?: string | null
          id?: string
          last_event_at?: string | null
          name?: string | null
          org_id?: string | null
          phone?: string | null
          source?: string | null
          stage?: string
          state?: string | null
          street?: string | null
          street2?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      misc_inventory: {
        Row: {
          crack_repair: number
          deleted: boolean
          id: string
          moisture_mitigation: number
          org_id: string | null
          shot: number
          silica_sand: number
          synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          crack_repair: number
          deleted?: boolean
          id: string
          moisture_mitigation?: number
          org_id?: string | null
          shot: number
          silica_sand: number
          synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          crack_repair?: number
          deleted?: boolean
          id?: string
          moisture_mitigation?: number
          org_id?: string | null
          shot?: number
          silica_sand?: number
          synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "misc_inventory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invite_code: string
          invited_by: string
          org_id: string
          permissions: Json | null
          role: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code?: string
          invited_by: string
          org_id: string
          permissions?: Json | null
          role?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code?: string
          invited_by?: string
          org_id?: string
          permissions?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          access_level: string
          email: string
          id: string
          invited_by: string | null
          joined_at: string
          org_id: string
          permissions: Json | null
          role: string
          user_id: string
        }
        Insert: {
          access_level?: string
          email: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          org_id: string
          permissions?: Json | null
          role?: string
          user_id: string
        }
        Update: {
          access_level?: string
          email?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          org_id?: string
          permissions?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
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
          name: string
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
      pricing: {
        Row: {
          abrasion_resistance_price_per_sqft: number
          anti_slip_price_per_sqft: number
          auto_reminder_rules: Json | null
          chip_reclaim_rate: number | null
          chip_vertical_usage_factor: number | null
          coating_removal_epoxy_per_sqft: number
          coating_removal_paint_per_sqft: number
          crack_fill_factor_units_per_gallon: number | null
          created_at: string
          default_day_hours: number | null
          default_reminder_days: number | null
          default_reminder_time: string | null
          deleted: boolean | null
          discount_config: Json | null
          floor_price_max: number | null
          floor_price_min: number | null
          gas_generator_gallons_per_hour: number | null
          gas_heater_gallons_per_hour: number | null
          gas_heater_months: Json | null
          id: string
          minimum_job_price: number | null
          minimum_margin_buffer: number | null
          moisture_mitigation_per_sqft: number
          org_id: string | null
          stale_contact_days: number | null
          suggested_crack_fill_price_multiplier: number | null
          suggested_discount_cap_sqft: number | null
          synced_at: string | null
          travel_gas_mpg: number | null
          updated_at: string
          use_suggested_discount_cap: boolean | null
          user_id: string
          vertical_price_per_sqft: number
          vertical_spread_usage_multiplier: number | null
        }
        Insert: {
          abrasion_resistance_price_per_sqft?: number
          anti_slip_price_per_sqft?: number
          auto_reminder_rules?: Json | null
          chip_reclaim_rate?: number | null
          chip_vertical_usage_factor?: number | null
          coating_removal_epoxy_per_sqft?: number
          coating_removal_paint_per_sqft?: number
          crack_fill_factor_units_per_gallon?: number | null
          created_at?: string
          default_day_hours?: number | null
          default_reminder_days?: number | null
          default_reminder_time?: string | null
          deleted?: boolean | null
          discount_config?: Json | null
          floor_price_max?: number | null
          floor_price_min?: number | null
          gas_generator_gallons_per_hour?: number | null
          gas_heater_gallons_per_hour?: number | null
          gas_heater_months?: Json | null
          id: string
          minimum_job_price?: number | null
          minimum_margin_buffer?: number | null
          moisture_mitigation_per_sqft?: number
          org_id?: string | null
          stale_contact_days?: number | null
          suggested_crack_fill_price_multiplier?: number | null
          suggested_discount_cap_sqft?: number | null
          synced_at?: string | null
          travel_gas_mpg?: number | null
          updated_at?: string
          use_suggested_discount_cap?: boolean | null
          user_id: string
          vertical_price_per_sqft?: number
          vertical_spread_usage_multiplier?: number | null
        }
        Update: {
          abrasion_resistance_price_per_sqft?: number
          anti_slip_price_per_sqft?: number
          auto_reminder_rules?: Json | null
          chip_reclaim_rate?: number | null
          chip_vertical_usage_factor?: number | null
          coating_removal_epoxy_per_sqft?: number
          coating_removal_paint_per_sqft?: number
          crack_fill_factor_units_per_gallon?: number | null
          created_at?: string
          default_day_hours?: number | null
          default_reminder_days?: number | null
          default_reminder_time?: string | null
          deleted?: boolean | null
          discount_config?: Json | null
          floor_price_max?: number | null
          floor_price_min?: number | null
          gas_generator_gallons_per_hour?: number | null
          gas_heater_gallons_per_hour?: number | null
          gas_heater_months?: Json | null
          id?: string
          minimum_job_price?: number | null
          minimum_margin_buffer?: number | null
          moisture_mitigation_per_sqft?: number
          org_id?: string | null
          stale_contact_days?: number | null
          suggested_crack_fill_price_multiplier?: number | null
          suggested_discount_cap_sqft?: number | null
          synced_at?: string | null
          travel_gas_mpg?: number | null
          updated_at?: string
          use_suggested_discount_cap?: boolean | null
          user_id?: string
          vertical_price_per_sqft?: number
          vertical_spread_usage_multiplier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_variables: {
        Row: {
          chip_reclaim_rate: number | null
          created_at: string
          default_day_hours: number | null
          deleted: boolean
          id: string
          name: string
          org_id: string | null
          synced_at: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          chip_reclaim_rate?: number | null
          created_at?: string
          default_day_hours?: number | null
          deleted?: boolean
          id: string
          name: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          chip_reclaim_rate?: number | null
          created_at?: string
          default_day_hours?: number | null
          deleted?: boolean
          id?: string
          name?: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_variables_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cost: number
          created_at: string
          deleted: boolean
          description: string | null
          id: string
          name: string
          org_id: string | null
          price: number
          synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          deleted?: boolean
          description?: string | null
          id: string
          name: string
          org_id?: string | null
          price?: number
          synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          deleted?: boolean
          description?: string | null
          id?: string
          name?: string
          org_id?: string | null
          price?: number
          synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_associates: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          deleted: boolean
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string | null
          phone: string | null
          service_ids: Json
          synced_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          deleted?: boolean
          email?: string | null
          id: string
          name: string
          notes?: string | null
          org_id?: string | null
          phone?: string | null
          service_ids?: Json
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          deleted?: boolean
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string | null
          phone?: string | null
          service_ids?: Json
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_associates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_services: {
        Row: {
          created_at: string
          deleted: boolean
          id: string
          name: string
          org_id: string | null
          synced_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          id: string
          name: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_services_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      route_planner_settings: {
        Row: {
          buffer_minutes: number | null
          created_at: string | null
          default_duration_minutes: number | null
          deleted: boolean | null
          google_client_id: string | null
          home_base_address: string | null
          home_base_lat: number | null
          home_base_lng: number | null
          id: string
          lookahead_days: number | null
          org_id: string | null
          synced_at: string | null
          updated_at: string | null
          user_id: string
          work_end_hour: string | null
          work_start_hour: string | null
        }
        Insert: {
          buffer_minutes?: number | null
          created_at?: string | null
          default_duration_minutes?: number | null
          deleted?: boolean | null
          google_client_id?: string | null
          home_base_address?: string | null
          home_base_lat?: number | null
          home_base_lng?: number | null
          id: string
          lookahead_days?: number | null
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string | null
          user_id: string
          work_end_hour?: string | null
          work_start_hour?: string | null
        }
        Update: {
          buffer_minutes?: number | null
          created_at?: string | null
          default_duration_minutes?: number | null
          deleted?: boolean | null
          google_client_id?: string | null
          home_base_address?: string | null
          home_base_lat?: number | null
          home_base_lng?: number | null
          id?: string
          lookahead_days?: number | null
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string | null
          user_id?: string
          work_end_hour?: string | null
          work_start_hour?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_planner_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          completed: boolean
          created_at: string
          deleted: boolean
          id: string
          name: string
          org_id: string | null
          synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          deleted?: boolean
          id: string
          name: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          deleted?: boolean
          id?: string
          name?: string
          org_id?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          completed_at: string | null
          errors: Json | null
          id: string
          records_pulled: number | null
          records_pushed: number | null
          started_at: string
          success: boolean | null
          sync_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          errors?: Json | null
          id?: string
          records_pulled?: number | null
          records_pushed?: number | null
          started_at?: string
          success?: boolean | null
          sync_type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          errors?: Json | null
          id?: string
          records_pulled?: number | null
          records_pushed?: number | null
          started_at?: string
          success?: boolean | null
          sync_type?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_queue: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          operation_type: string
          processed_at: string | null
          record_data: Json | null
          record_id: string
          retry_count: number
          table_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          operation_type: string
          processed_at?: string | null
          record_data?: Json | null
          record_id: string
          retry_count?: number
          table_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          operation_type?: string
          processed_at?: string | null
          record_data?: Json | null
          record_id?: string
          retry_count?: number
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      systems: {
        Row: {
          base_coats: number
          base_spread: number | null
          box_cost: number
          created_at: string
          cyclo1_coats: number
          cyclo1_spread: number | null
          deleted: boolean
          double_broadcast: boolean | null
          feet_per_lb: number
          floor_price_max: number | null
          floor_price_min: number | null
          id: string
          is_default: boolean | null
          name: string
          notes: string | null
          org_id: string | null
          synced_at: string | null
          target_effective_price_per_sqft: number | null
          top_coats: number
          top_spread: number | null
          updated_at: string
          user_id: string
          vertical_price_per_sqft: number | null
        }
        Insert: {
          base_coats?: number
          base_spread?: number | null
          box_cost: number
          created_at?: string
          cyclo1_coats?: number
          cyclo1_spread?: number | null
          deleted?: boolean
          double_broadcast?: boolean | null
          feet_per_lb: number
          floor_price_max?: number | null
          floor_price_min?: number | null
          id: string
          is_default?: boolean | null
          name: string
          notes?: string | null
          org_id?: string | null
          synced_at?: string | null
          target_effective_price_per_sqft?: number | null
          top_coats?: number
          top_spread?: number | null
          updated_at?: string
          user_id: string
          vertical_price_per_sqft?: number | null
        }
        Update: {
          base_coats?: number
          base_spread?: number | null
          box_cost?: number
          created_at?: string
          cyclo1_coats?: number
          cyclo1_spread?: number | null
          deleted?: boolean
          double_broadcast?: boolean | null
          feet_per_lb?: number
          floor_price_max?: number | null
          floor_price_min?: number | null
          id?: string
          is_default?: boolean | null
          name?: string
          notes?: string | null
          org_id?: string | null
          synced_at?: string | null
          target_effective_price_per_sqft?: number | null
          top_coats?: number
          top_spread?: number | null
          updated_at?: string
          user_id?: string
          vertical_price_per_sqft?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "systems_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tint_inventory: {
        Row: {
          color: string
          deleted: boolean
          id: string
          org_id: string | null
          ounces: number
          synced_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color: string
          deleted?: boolean
          id: string
          org_id?: string | null
          ounces?: number
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string
          deleted?: boolean
          id?: string
          org_id?: string | null
          ounces?: number
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tint_inventory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      topcoat_inventory: {
        Row: {
          deleted: boolean
          id: string
          org_id: string | null
          synced_at: string | null
          top_a: number
          top_b: number
          updated_at: string
          user_id: string
        }
        Insert: {
          deleted?: boolean
          id: string
          org_id?: string | null
          synced_at?: string | null
          top_a: number
          top_b: number
          updated_at?: string
          user_id: string
        }
        Update: {
          deleted?: boolean
          id?: string
          org_id?: string | null
          synced_at?: string | null
          top_a?: number
          top_b?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topcoat_inventory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          auto_sync_enabled: boolean
          created_at: string
          sync_interval_minutes: number
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          created_at?: string
          sync_interval_minutes?: number
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_sync_enabled?: boolean
          created_at?: string
          sync_interval_minutes?: number
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: { p_invite_code: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organization: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_organization: { Args: { p_org_id: string }; Returns: undefined }
      generate_invite_code: { Args: never; Returns: string }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      lookup_invite_by_code: {
        Args: { p_invite_code: string }
        Returns: {
          invitation_id: string
          invite_permissions: Json
          invite_role: string
          invited_by_user: string
          org_created_at: string
          org_created_by: string
          org_id: string
          org_name: string
          org_updated_at: string
        }[]
      }
      migrate_user_data_to_org: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      org_can_write: {
        Args: { p_features: string[]; p_org_id: string }
        Returns: boolean
      }
      title_case: { Args: { input_text: string }; Returns: string }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
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
    Enums: {},
  },
} as const
