/* Types TypeScript mobile (sous-ensemble du web) / Mobile TypeScript types */

export interface PickupSummaryItem {
  support_type_code: string
  support_type_name: string
  total_labels: number
  pending_labels: number
}

export interface DriverTourStop {
  id: number
  sequence_order: number
  eqp_count: number
  pdv_code?: string
  pdv_name?: string
  pdv_address?: string
  pdv_city?: string
  pdv_latitude?: number
  pdv_longitude?: number
  delivery_status?: string
  arrival_time?: string
  departure_time?: string
  actual_arrival_time?: string
  actual_departure_time?: string
  pickup_cardboard: boolean
  pickup_containers: boolean
  pickup_returns: boolean
  pickup_consignment: boolean
  scanned_supports_count?: number
  pending_pickup_labels_count?: number
  pickup_summary?: PickupSummaryItem[]
}

export interface PickupLabelMobile {
  id: number
  pickup_request_id: number
  label_code: string
  sequence_number: number
  status: string
  tour_stop_id?: number | null
  picked_up_at?: string | null
  picked_up_device_id?: number | null
  received_at?: string | null
}

export interface SupportScan {
  id: number
  tour_stop_id: number
  barcode: string
  timestamp: string
  expected_at_stop: boolean
}

export interface DriverTour {
  id: number
  code: string
  date: string
  delivery_date?: string
  departure_time?: string
  return_time?: string
  total_eqp?: number
  status: string
  base_code?: string
  base_name?: string
  vehicle_code?: string
  vehicle_name?: string
  stops: DriverTourStop[]
}

export interface AvailableTour {
  id: number
  code: string
  delivery_date?: string
  departure_time?: string
  total_eqp?: number
  stops_count: number
  driver_name?: string
  vehicle_code?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
}

export interface UserMe {
  id: number
  username: string
  email: string
  is_superadmin: boolean
}
