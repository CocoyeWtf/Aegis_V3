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
  has_sas_sec: boolean
  sas_sec_surface_m2?: number
  sas_sec_capacity_eqc?: number
  has_sas_frais: boolean
  sas_frais_surface_m2?: number
  sas_frais_capacity_eqc?: number
  has_sas_gel: boolean
  sas_gel_surface_m2?: number
  sas_gel_capacity_eqc?: number
  has_dock: boolean
  dock_has_niche: boolean
  dock_time_minutes?: number
  unload_time_per_eqp_minutes?: number
  delivery_window_start?: string
  delivery_window_end?: string
  access_constraints?: string
  allowed_vehicle_types?: string
  region_id: number
}

export type TemperatureType = 'GEL' | 'FRAIS' | 'SEC' | 'BI_TEMP' | 'TRI_TEMP'
export type VehicleType = 'SEMI' | 'PORTEUR' | 'PORTEUR_SURBAISSE' | 'PORTEUR_REMORQUE' | 'CITY' | 'VL'
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
  activity_type?: string | null      // 'SUIVI' | 'MEAV'
  promo_start_date?: string | null   // YYYY-MM-DD
  split_group_id?: number | null
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
  wms_tour_code?: string
  driver_user_id?: number | null
  device_assignment_id?: number | null
  actual_return_time?: string | null
  vehicle_id?: number | null
  tractor_id?: number | null
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
  PORTEUR_SURBAISSE: { label: 'Porteur surbaissé', capacity_eqp: 33 },
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
  badge_code?: string
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
  app_version?: string | null
  os_version?: string | null
  last_seen_at?: string | null
}

export interface DeviceAssignment {
  id: number
  device_id: number
  user_id: number
  tour_id: number
  date: string
  driver_name?: string | null
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
  actual_arrival_time?: string
  actual_departure_time?: string
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

/* ─── Manifeste WMS / WMS Manifest types ─── */

export interface ManifestLine {
  id: number
  pdv_code: string
  support_number: string
  support_label?: string
  eqc: number
  nb_colis: number
  scanned: boolean
  scanned_at_stop_id?: number
  scanned_at?: string
}

export interface ManifestImportResult {
  created: number
  skipped: number
  total_rows: number
  errors: string[]
}

/* ─── KPI Ponctualité / Punctuality KPI types ─── */

export interface PunctualityMetrics {
  on_time: number
  late: number
  no_scan: number
  pct: number
}

export interface PunctualityKpiResponse {
  summary: {
    total_stops: number
    with_deadline: number
    cdc: PunctualityMetrics
    operational: PunctualityMetrics
  }
  by_activity: Record<string, {
    total: number
    cdc: PunctualityMetrics
    operational: PunctualityMetrics
  }>
  by_date: { date: string; total: number; cdc_pct: number; operational_pct: number }[]
  by_pdv: { pdv_id: number; pdv_code: string; pdv_name: string; total: number;
            cdc_pct: number; operational_pct: number }[]
}

/* ─── SurchargeType ─── */

export interface SurchargeType {
  id: number
  code: string
  label: string
  is_active: boolean
}

/* ─── Fleet & Vehicle Management ─── */

export type FleetVehicleType = 'TRACTEUR' | 'SEMI_REMORQUE' | 'PORTEUR' | 'PORTEUR_SURBAISSE' | 'REMORQUE' | 'VL' | 'SEMI' | 'PORTEUR_REMORQUE' | 'CITY'
export type VehicleStatusType = 'ACTIVE' | 'MAINTENANCE' | 'OUT_OF_SERVICE' | 'DISPOSED'
export type FuelTypeEnum = 'DIESEL' | 'ESSENCE' | 'GNV' | 'ELECTRIQUE' | 'HYBRIDE'
export type OwnershipType = 'OWNED' | 'LEASED' | 'RENTED'

export interface Vehicle {
  id: number
  code: string
  name?: string
  license_plate?: string
  vin?: string
  brand?: string
  model?: string
  fleet_vehicle_type: FleetVehicleType
  status: VehicleStatusType
  fuel_type?: FuelTypeEnum
  temperature_type?: TemperatureType
  capacity_eqp?: number
  capacity_weight_kg?: number
  has_tailgate: boolean
  tailgate_type?: string
  first_registration_date?: string
  acquisition_date?: string
  disposal_date?: string
  current_km?: number
  last_km_update?: string
  ownership_type?: OwnershipType
  lessor_name?: string
  lease_start_date?: string
  lease_end_date?: string
  monthly_lease_cost?: number
  lease_contract_ref?: string
  purchase_price?: number
  depreciation_years?: number
  residual_value?: number
  insurance_company?: string
  insurance_policy_number?: string
  insurance_start_date?: string
  insurance_end_date?: string
  insurance_annual_cost?: number
  last_technical_inspection_date?: string
  next_technical_inspection_date?: string
  tachograph_type?: string
  tachograph_next_calibration?: string
  region_id?: number
  notes?: string
  qr_code?: string
}

export interface VehicleSummary {
  id: number
  code: string
  name?: string
  license_plate?: string
  fleet_vehicle_type: FleetVehicleType
  status: VehicleStatusType
  qr_code?: string
}

export interface InspectionTemplate {
  id: number
  label: string
  description?: string
  category: string
  applicable_vehicle_types?: string
  is_critical: boolean
  requires_photo: boolean
  display_order: number
  is_active: boolean
}

export interface InspectionItem {
  id: number
  inspection_id: number
  template_id?: number
  label: string
  category: string
  result: string
  comment?: string
  is_critical: boolean
}

export interface InspectionPhoto {
  id: number
  inspection_id: number
  item_id?: number
  filename: string
  file_size?: number
  mime_type?: string
  uploaded_at: string
}

export interface VehicleInspection {
  id: number
  vehicle_id: number
  tour_id?: number
  device_id?: number
  inspection_type: string
  status: string
  driver_name?: string
  km_at_inspection?: number
  latitude?: number
  longitude?: number
  started_at: string
  completed_at?: string
  remarks?: string
  has_critical_defect: boolean
  items: InspectionItem[]
  photos: InspectionPhoto[]
  vehicle_code?: string
  vehicle_name?: string
}

export interface MaintenanceRecord {
  id: number
  vehicle_id: number
  maintenance_type: string
  status: string
  description?: string
  provider_name?: string
  scheduled_date?: string
  scheduled_km?: number
  completed_date?: string
  km_at_service?: number
  cost_parts?: number
  cost_labor?: number
  cost_total?: number
  invoice_ref?: string
  inspection_id?: number
  notes?: string
  created_at?: string
}

export interface MaintenanceScheduleRule {
  id: number
  label: string
  maintenance_type: string
  applicable_vehicle_types?: string
  interval_km?: number
  interval_months?: number
  is_active: boolean
}

export interface FuelEntry {
  id: number
  vehicle_id: number
  date: string
  km_at_fill?: number
  liters: number
  price_per_liter?: number
  total_cost?: number
  is_full_tank: boolean
  station_name?: string
  driver_name?: string
  notes?: string
}

export interface VehicleModificationEntry {
  id: number
  vehicle_id: number
  date: string
  description: string
  cost?: number
  provider_name?: string
  invoice_ref?: string
  notes?: string
}

export interface VehicleCostEntry {
  id: number
  vehicle_id: number
  category: string
  date: string
  description?: string
  amount: number
  invoice_ref?: string
  notes?: string
}

export interface VehicleTCOItem {
  vehicle_id: number
  vehicle_code: string
  vehicle_name?: string
  fleet_vehicle_type: string
  ownership_type?: string
  lease_cost: number
  depreciation_cost: number
  maintenance_cost: number
  fuel_cost: number
  modification_cost: number
  other_costs: number
  total_cost: number
  total_km: number
  cost_per_km?: number
}

export interface FleetDashboard {
  vehicles: VehicleTCOItem[]
  total_fleet_cost: number
  total_fleet_km: number
  avg_cost_per_km?: number
}

/* ─── Driver Declarations ─── */

export interface DeclarationPhoto {
  id: number
  declaration_id: number
  filename: string
  file_size?: number
  mime_type?: string
  uploaded_at: string
}

export interface Declaration {
  id: number
  device_id: number
  tour_id?: number | null
  tour_stop_id?: number | null
  declaration_type: string
  description?: string | null
  latitude?: number | null
  longitude?: number | null
  accuracy?: number | null
  driver_name?: string | null
  created_at: string
  photos: DeclarationPhoto[]
}
