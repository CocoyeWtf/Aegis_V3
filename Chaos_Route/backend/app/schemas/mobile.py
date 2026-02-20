"""Schemas mobile / Mobile schemas — devices, assignments, GPS, stops, alerts."""

from pydantic import BaseModel, ConfigDict


# ─── MobileDevice ───

class MobileDeviceCreate(BaseModel):
    friendly_name: str | None = None
    base_id: int | None = None

class MobileDeviceUpdate(BaseModel):
    device_identifier: str | None = None
    friendly_name: str | None = None
    base_id: int | None = None
    is_active: bool | None = None

class MobileDeviceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_identifier: str | None = None
    friendly_name: str | None = None
    registration_code: str
    base_id: int | None = None
    is_active: bool
    registered_at: str | None = None

class DeviceRegistration(BaseModel):
    """Enregistrement mobile via QR / Mobile registration via QR code."""
    registration_code: str
    device_identifier: str


# ─── DeviceAssignment ───

class DeviceAssignmentCreate(BaseModel):
    device_id: int
    tour_id: int
    date: str  # YYYY-MM-DD
    driver_name: str | None = None

class DeviceAssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_id: int
    tour_id: int
    date: str
    driver_name: str | None = None
    user_id: int | None = None
    assigned_at: str | None = None
    returned_at: str | None = None


# ─── GPS ───

class GPSPositionCreate(BaseModel):
    latitude: float
    longitude: float
    accuracy: float | None = None
    speed: float | None = None
    timestamp: str  # ISO 8601

class GPSBatchCreate(BaseModel):
    """Batch de positions GPS / GPS position batch."""
    tour_id: int
    positions: list[GPSPositionCreate]

class GPSPositionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_id: int
    tour_id: int
    latitude: float
    longitude: float
    accuracy: float | None = None
    speed: float | None = None
    timestamp: str


# ─── StopEvent ───

class StopEventCreate(BaseModel):
    """Scan PDV a l'arrivee / PDV scan on arrival."""
    scanned_pdv_code: str
    latitude: float | None = None
    longitude: float | None = None
    accuracy: float | None = None
    timestamp: str
    notes: str | None = None

class StopClosureCreate(BaseModel):
    """Cloture d'un stop / Stop closure."""
    latitude: float | None = None
    longitude: float | None = None
    accuracy: float | None = None
    timestamp: str
    notes: str | None = None
    force: bool = False


# ─── SupportScan ───

class SupportScanCreate(BaseModel):
    """Scan d'un support (code barre 1D) / Support barcode scan."""
    barcode: str
    latitude: float | None = None
    longitude: float | None = None
    timestamp: str

class SupportScanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tour_stop_id: int
    barcode: str
    timestamp: str
    expected_at_stop: bool = True


# ─── Driver Tour views ───

class DriverTourStopRead(BaseModel):
    """Vue stop pour le chauffeur / Driver stop view."""
    id: int
    sequence_order: int
    eqp_count: int
    pdv_code: str | None = None
    pdv_name: str | None = None
    pdv_address: str | None = None
    pdv_city: str | None = None
    pdv_latitude: float | None = None
    pdv_longitude: float | None = None
    delivery_status: str | None = None
    arrival_time: str | None = None
    departure_time: str | None = None
    actual_arrival_time: str | None = None
    actual_departure_time: str | None = None
    pickup_cardboard: bool = False
    pickup_containers: bool = False
    pickup_returns: bool = False
    scanned_supports_count: int = 0
    pending_pickup_labels_count: int = 0

class DriverTourRead(BaseModel):
    """Vue tour complete pour le chauffeur / Full driver tour view."""
    id: int
    code: str
    date: str
    delivery_date: str | None = None
    departure_time: str | None = None
    return_time: str | None = None
    total_eqp: int | None = None
    status: str
    base_code: str | None = None
    base_name: str | None = None
    vehicle_code: str | None = None
    vehicle_name: str | None = None
    stops: list[DriverTourStopRead] = []


# ─── Tour assignment from mobile ───

class AvailableTourRead(BaseModel):
    """Tour disponible pour affectation depuis le mobile / Available tour for mobile assignment."""
    id: int
    code: str
    delivery_date: str | None = None
    departure_time: str | None = None
    total_eqp: int | None = None
    stops_count: int = 0
    driver_name: str | None = None
    vehicle_code: str | None = None

class SelfAssignCreate(BaseModel):
    """Affectation tour depuis le mobile / Tour assignment from mobile."""
    tour_id: int
    driver_name: str | None = None


# ─── DeliveryAlert ───

class DeliveryAlertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tour_id: int
    tour_stop_id: int | None = None
    alert_type: str
    severity: str
    message: str | None = None
    created_at: str
    acknowledged_at: str | None = None
    acknowledged_by: int | None = None
    device_id: int | None = None

class AlertAcknowledge(BaseModel):
    pass  # user_id from JWT


# ─── ReturnToBase ───

class ReturnToBaseCreate(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    timestamp: str


# ─── DriverPosition (tracking dashboard) ───

class DriverPositionRead(BaseModel):
    """Derniere position d'un chauffeur pour le dashboard / Latest driver position for dashboard."""
    tour_id: int
    tour_code: str
    driver_name: str | None = None
    latitude: float
    longitude: float
    speed: float | None = None
    accuracy: float | None = None
    timestamp: str
    stops_total: int = 0
    stops_delivered: int = 0

class TrackingDashboard(BaseModel):
    """Stats resume suivi / Tracking dashboard stats."""
    active_tours: int = 0
    completed_tours: int = 0
    delayed_tours: int = 0
    active_alerts: int = 0
