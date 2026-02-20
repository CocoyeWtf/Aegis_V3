"""Schémas Tour / Tour schemas."""

from pydantic import BaseModel, ConfigDict

from app.models.contract import VehicleType
from app.models.tour import TourStatus


class TourStopBase(BaseModel):
    pdv_id: int
    sequence_order: int
    eqp_count: int
    arrival_time: str | None = None
    departure_time: str | None = None
    distance_from_previous_km: float | None = None
    duration_from_previous_minutes: int | None = None
    pickup_cardboard: bool = False
    pickup_containers: bool = False
    pickup_returns: bool = False


class TourStopCreate(TourStopBase):
    pass


class TourStopRead(TourStopBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tour_id: int
    delivery_status: str | None = None
    actual_arrival_time: str | None = None
    actual_departure_time: str | None = None
    missing_supports_count: int | None = 0
    forced_closure: bool = False
    delivery_notes: str | None = None


class TourBase(BaseModel):
    date: str
    code: str
    vehicle_type: str | None = None
    capacity_eqp: int | None = None
    contract_id: int | None = None
    departure_time: str | None = None
    return_time: str | None = None
    total_km: float | None = None
    total_duration_minutes: int | None = None
    total_eqp: int | None = None
    total_cost: float | None = None
    total_weight_kg: float | None = None
    status: TourStatus = TourStatus.DRAFT
    base_id: int
    delivery_date: str | None = None
    driver_name: str | None = None
    driver_arrival_time: str | None = None
    loading_end_time: str | None = None
    barrier_exit_time: str | None = None
    barrier_entry_time: str | None = None
    remarks: str | None = None
    loader_code: str | None = None
    loader_name: str | None = None
    trailer_number: str | None = None
    dock_door_number: str | None = None
    trailer_ready_time: str | None = None
    eqp_loaded: int | None = None
    departure_signal_time: str | None = None
    driver_user_id: int | None = None
    device_assignment_id: int | None = None
    actual_return_time: str | None = None


class TourCreate(TourBase):
    stops: list[TourStopCreate] = []


class TourUpdate(BaseModel):
    date: str | None = None
    code: str | None = None
    vehicle_type: str | None = None
    capacity_eqp: int | None = None
    contract_id: int | None = None
    departure_time: str | None = None
    return_time: str | None = None
    total_km: float | None = None
    total_duration_minutes: int | None = None
    total_eqp: int | None = None
    total_cost: float | None = None
    total_weight_kg: float | None = None
    status: TourStatus | None = None
    base_id: int | None = None
    delivery_date: str | None = None
    driver_name: str | None = None
    driver_arrival_time: str | None = None
    loading_end_time: str | None = None
    barrier_exit_time: str | None = None
    barrier_entry_time: str | None = None
    remarks: str | None = None
    loader_code: str | None = None
    loader_name: str | None = None
    trailer_number: str | None = None
    dock_door_number: str | None = None
    trailer_ready_time: str | None = None
    eqp_loaded: int | None = None
    departure_signal_time: str | None = None
    driver_user_id: int | None = None
    device_assignment_id: int | None = None
    actual_return_time: str | None = None


class TourOperationsUpdate(BaseModel):
    """Mise à jour exploitant / Operations update (driver, loading, weight, remarks)."""
    driver_name: str | None = None
    driver_arrival_time: str | None = None
    loading_end_time: str | None = None
    total_weight_kg: float | None = None
    remarks: str | None = None
    loader_code: str | None = None
    loader_name: str | None = None
    trailer_number: str | None = None
    dock_door_number: str | None = None
    trailer_ready_time: str | None = None
    eqp_loaded: int | None = None
    departure_signal_time: str | None = None


class TourGateUpdate(BaseModel):
    """Mise à jour poste de garde / Gate update (barrier times)."""
    barrier_exit_time: str | None = None
    barrier_entry_time: str | None = None


class TourSchedule(BaseModel):
    """Planification : contrat + heure de départ / Schedule: contract + departure time."""
    contract_id: int
    departure_time: str  # HH:MM
    delivery_date: str | None = None  # YYYY-MM-DD


class TourRead(TourBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    stops: list[TourStopRead] = []
