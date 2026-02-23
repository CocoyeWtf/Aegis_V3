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
  dispatch_date?: string | null
  dispatch_time?: string | null
  tour_id?: number | null
}

export type TourStatus = 'DRAFT' | 'VALIDATED' | 'IN_PROGRESS' | 'RETURNING' | 'COMPLETED'

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
  pickup_consignment?: boolean
  delivery_status?: string
  actual_arrival_time?: string
  actual_departure_time?: string
  missing_supports_count?: number
  forced_closure?: boolean
  delivery_notes?: string
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
  delivery_date?: string | null
  temperature_type?: TemperatureType
  stops: TourStop[]
  driver_name?: string
  driver_arrival_time?: string
  loading_end_time?: string
  barrier_exit_time?: string
  barrier_entry_time?: string
  km_departure?: number | null
  km_return?: number | null
  remarks?: string
  loader_code?: string
  loader_name?: string
  trailer_number?: string
  dock_door_number?: string
  trailer_ready_time?: string
  eqp_loaded?: number
  departure_signal_time?: string
  driver_user_id?: number | null
  device_assignment_id?: number | null
  actual_return_time?: string | null
}

export interface Loader {
  id: number
  code: string
  name: string
  base_id: number
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
  pickup_consignment: boolean
}

export interface WaybillData {
  tour_id: number
  tour_code: string
  date: string
  delivery_date?: string | null
  dispatch_date?: string | null
  dispatch_time?: string | null
  departure_time?: string
  return_time?: string
  driver_name?: string
  dock_door_number?: string | null
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

/* Couleurs température / Temperature colors */
export const TEMPERATURE_COLORS: Record<TemperatureClass, string> = {
  GEL: '#1e40af',
  FRAIS: '#3b82f6',
  SEC: '#f97316',
}

/* Labels type température / Temperature type labels */
export const TEMPERATURE_TYPE_LABELS: Record<TemperatureType, string> = {
  SEC: 'Sec',
  FRAIS: 'Frais',
  GEL: 'Gel',
  BI_TEMP: 'Bi-temp',
  TRI_TEMP: 'Tri-temp',
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
  pdv_id?: number | null
  roles: { id: number; name: string }[]
  regions: { id: number; name: string }[]
  created_at: string
  updated_at: string
}

/* ─── Mobile / Tracking types ─── */

export interface MobileDevice {
  id: number
  device_identifier: string | null
  friendly_name?: string
  registration_code: string
  base_id?: number | null
  is_active: boolean
  registered_at?: string | null
}

export interface DeviceAssignment {
  id: number
  device_id: number
  user_id: number
  tour_id: number
  date: string
  assigned_at?: string
  returned_at?: string
}

export interface GPSPosition {
  id: number
  device_id: number
  tour_id: number
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number
  timestamp: string
}

export interface DriverPosition {
  tour_id: number
  tour_code: string
  driver_name?: string
  latitude: number
  longitude: number
  speed?: number
  accuracy?: number
  timestamp: string
  stops_total: number
  stops_delivered: number
}

export interface ActiveTourStop {
  stop_id: number
  sequence_order: number
  delivery_status: string
  arrival_time?: string
  eqp_count: number
  pdv_code?: string
  pdv_name?: string
  pdv_city?: string
  pdv_latitude?: number
  pdv_longitude?: number
  pdv_delivery_window_start?: string
  pdv_delivery_window_end?: string
}

export interface ActiveTour {
  tour_id: number
  tour_code: string
  driver_name?: string
  departure_time?: string
  stops: ActiveTourStop[]
}

export interface DeliveryAlert {
  id: number
  tour_id: number
  tour_stop_id?: number | null
  alert_type: string
  severity: string
  message?: string
  created_at: string
  acknowledged_at?: string | null
  acknowledged_by?: number | null
  device_id?: number | null
}

/* ─── Pickup / Container return types ─── */

export interface SupportType {
  id: number
  code: string
  name: string
  unit_quantity: number
  unit_label?: string | null
  is_active: boolean
  image_path?: string | null
}

export type PickupTypeEnum = 'CONTAINER' | 'MERCHANDISE' | 'CARDBOARD' | 'CONSIGNMENT'
export type PickupStatusEnum = 'REQUESTED' | 'PLANNED' | 'PICKED_UP' | 'RECEIVED'
export type LabelStatusEnum = 'PENDING' | 'PLANNED' | 'PICKED_UP' | 'RECEIVED'

export interface PickupLabel {
  id: number
  pickup_request_id: number
  label_code: string
  sequence_number: number
  status: LabelStatusEnum
  tour_stop_id?: number | null
  picked_up_at?: string | null
  picked_up_device_id?: number | null
  received_at?: string | null
}

export interface PickupRequest {
  id: number
  pdv_id: number
  support_type_id: number
  quantity: number
  availability_date: string
  pickup_type: PickupTypeEnum
  status: PickupStatusEnum
  requested_at?: string | null
  requested_by_user_id?: number | null
  notes?: string | null
  pdv?: { id: number; code: string; name: string } | null
  support_type?: SupportType | null
  labels?: PickupLabel[]
}

export interface PdvDeliveryEntry {
  pdv_id: number
  pdv_code: string
  pdv_name: string
  delivery_date: string
  tour_code: string
  tour_id: number
  departure_time: string
  arrival_time: string
  eqp_count: number
  temperature_classes: TemperatureClass[]
  tour_status: TourStatus
  base_code: string
  base_name: string
}

export interface PdvPickupSummary {
  pdv_id: number
  pdv_code: string
  pdv_name: string
  pending_count: number
  requests: PickupRequest[]
}
