/* Types TypeScript pour Chaos RouteManager / TypeScript types */

export interface Country {
  id: number
  name: string
  code: string
}

export interface Region {
  id: number
  name: string
  country_id: number
}

export type BaseType = 'SEC_RAPIDE' | 'FRAIS_RAPIDE' | 'GEL_RAPIDE' | 'MIXTE_RAPIDE' | 'SEC_LENTE' | 'GEL_LENTE'

export interface BaseLogistics {
  id: number
  code: string
  name: string
  address?: string
  postal_code?: string
  city?: string
  phone?: string
  email?: string
  longitude?: number
  latitude?: number
  type: BaseType
  region_id: number
}

export type PDVType =
  | 'EXPRESS' | 'CONTACT' | 'SUPER_ALIMENTAIRE' | 'SUPER_GENERALISTE'
  | 'HYPER' | 'NETTO' | 'DRIVE' | 'URBAIN_PROXI'

export interface PDV {
  id: number
  code: string
  name: string
  address?: string
  postal_code?: string
  city?: string
  phone?: string
  email?: string
  longitude?: number
  latitude?: number
  type: PDVType
  has_sas: boolean
  sas_capacity?: number
  has_dock: boolean
  dock_time_minutes?: number
  unload_time_per_eqp_minutes?: number
  delivery_window_start?: string
  delivery_window_end?: string
  access_constraints?: string
  region_id: number
}

export type TemperatureType = 'GEL' | 'FRAIS' | 'SEC' | 'BI_TEMP' | 'TRI_TEMP'
export type VehicleType = 'SEMI' | 'PORTEUR' | 'PORTEUR_REMORQUE' | 'CITY' | 'VL'
export type TailgateType = 'RETRACTABLE' | 'RABATTABLE'

export interface Vehicle {
  id: number
  code: string
  name: string
  temperature_type: TemperatureType
  vehicle_type: VehicleType
  capacity_eqp: number
  capacity_weight_kg?: number
  fixed_cost?: number
  cost_per_km?: number
  has_tailgate: boolean
  tailgate_type?: TailgateType
  contract_start_date?: string
  contract_end_date?: string
  region_id: number
}

export interface Supplier {
  id: number
  code: string
  name: string
  address?: string
  postal_code?: string
  city?: string
  phone?: string
  email?: string
  longitude?: number
  latitude?: number
  region_id: number
}

export type TemperatureClass = 'SEC' | 'FRAIS' | 'GEL'

export interface Volume {
  id: number
  pdv_id: number
  date: string
  eqp_count: number
  weight_kg?: number
  temperature_class: TemperatureClass
  base_origin_id: number
  preparation_start?: string
  preparation_end?: string
}

export type TourStatus = 'DRAFT' | 'VALIDATED' | 'IN_PROGRESS' | 'COMPLETED'

export interface TourStop {
  id: number
  tour_id: number
  pdv_id: number
  sequence_order: number
  eqp_count: number
  arrival_time?: string
  departure_time?: string
  distance_from_previous_km?: number
  duration_from_previous_minutes?: number
}

export interface Tour {
  id: number
  date: string
  code: string
  vehicle_id: number
  contract_id?: number
  departure_time?: string
  return_time?: string
  total_km?: number
  total_duration_minutes?: number
  total_eqp?: number
  total_cost?: number
  status: TourStatus
  base_id: number
  stops: TourStop[]
}

export interface Contract {
  id: number
  transporter_name: string
  code: string
  fixed_daily_cost?: number
  cost_per_km?: number
  cost_per_hour?: number
  min_hours_per_day?: number
  min_km_per_day?: number
  start_date?: string
  end_date?: string
  region_id: number
}

export interface DistanceEntry {
  id: number
  origin_type: string
  origin_id: number
  destination_type: string
  destination_id: number
  distance_km: number
  duration_minutes: number
}

export interface Parameter {
  id: number
  key: string
  value: string
  value_type: string
  region_id?: number
  effective_date?: string
  end_date?: string
}
