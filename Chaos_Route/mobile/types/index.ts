/* Types TypeScript mobile (sous-ensemble du web) / Mobile TypeScript types */

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
  scanned_supports_count?: number
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
