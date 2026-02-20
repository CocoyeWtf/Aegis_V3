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

export interface BaseActivity {
  id: number
  code: string
  name: string
}

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
  region_id: number
  activities: BaseActivity[]
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
  dock_has_niche: boolean
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
  nb_colis?: number
  eqp_count: number
  weight_kg?: number
  temperature_class: TemperatureClass
  base_origin_id: number
  preparation_start?: string
  preparation_end?: string
  tour_id?: number | null
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
  pickup_cardboard?: boolean
  pickup_containers?: boolean
  pickup_returns?: boolean
}

export interface Tour {
  id: number
  date: string
  code: string
  vehicle_type?: VehicleType
  capacity_eqp?: number
  contract_id?: number | null
  departure_time?: string
  return_time?: string
  total_km?: number
  total_duration_minutes?: number
  total_eqp?: number
  total_cost?: number
  total_weight_kg?: number
  status: TourStatus
  base_id: number
  stops: TourStop[]
  driver_name?: string
  driver_arrival_time?: string
  loading_end_time?: string
  barrier_exit_time?: string
  barrier_entry_time?: string
  remarks?: string
}

export interface WaybillStop {
  sequence: number
  pdv_code: string
  pdv_name: string
  address: string
  postal_code: string
  city: string
  eqp_count: number
  weight_kg: number
  temperature_classes: string[]
  arrival_time?: string
  departure_time?: string
  pickup_cardboard: boolean
  pickup_containers: boolean
  pickup_returns: boolean
}

export interface WaybillData {
  tour_id: number
  tour_code: string
  date: string
  departure_time?: string
  return_time?: string
  driver_name?: string
  remarks?: string
  base: {
    code: string
    name: string
    address: string
    postal_code: string
    city: string
  } | null
  contract: {
    code: string
    transporter_name: string
    vehicle_code?: string
    vehicle_name?: string
    temperature_type?: string
    vehicle_type?: string
    capacity_weight_kg?: number
  } | null
  stops: WaybillStop[]
  total_eqp: number
  total_weight_kg: number
}

/* Capacité par défaut selon le type de véhicule (en EQC) / Default capacity per vehicle type (in EQC) */
export const VEHICLE_TYPE_DEFAULTS: Record<VehicleType, { label: string; capacity_eqp: number }> = {
  SEMI: { label: 'Semi-remorque', capacity_eqp: 54 },
  PORTEUR: { label: 'Porteur', capacity_eqp: 33 },
  PORTEUR_REMORQUE: { label: 'Porteur + Remorque', capacity_eqp: 43 },
  CITY: { label: 'City', capacity_eqp: 16 },
  VL: { label: 'VL', capacity_eqp: 8 },
}

export interface ContractSchedule {
  id: number
  contract_id: number
  date: string  // YYYY-MM-DD
  is_available: boolean
}

export interface FuelPrice {
  id: number
  start_date: string
  end_date: string
  price_per_liter: number
}

export interface KmTaxEntry {
  id: number
  origin_type: string
  origin_id: number
  destination_type: string
  destination_id: number
  tax_per_km: number
  origin_label?: string
  destination_label?: string
}

export interface Contract {
  id: number
  transporter_name: string
  code: string
  fixed_daily_cost?: number
  vacation?: number
  cost_per_km?: number
  cost_per_hour?: number
  min_hours_per_day?: number
  min_km_per_day?: number
  consumption_coefficient?: number
  start_date?: string
  end_date?: string
  region_id: number
  // Champs véhicule / Vehicle fields
  vehicle_code?: string
  vehicle_name?: string
  temperature_type?: TemperatureType
  vehicle_type?: VehicleType
  capacity_eqp?: number
  capacity_weight_kg?: number
  has_tailgate?: boolean
  tailgate_type?: TailgateType
  schedules?: ContractSchedule[]
}

export interface DistanceEntry {
  id: number
  origin_type: string
  origin_id: number
  destination_type: string
  destination_id: number
  distance_km: number
  duration_minutes: number
  origin_label?: string
  destination_label?: string
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

/* Auth & RBAC types */
export interface Permission {
  id: number
  resource: string
  action: string
}

export interface Role {
  id: number
  name: string
  description?: string
  permissions: Permission[]
  created_at: string
}

export interface UserAccount {
  id: number
  username: string
  email: string
  is_active: boolean
  is_superadmin: boolean
  roles: { id: number; name: string }[]
  regions: { id: number; name: string }[]
  created_at: string
  updated_at: string
}
