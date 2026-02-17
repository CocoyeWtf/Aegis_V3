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
    status: TourStatus = TourStatus.DRAFT
    base_id: int
    driver_name: str | None = None
    driver_arrival_time: str | None = None
    loading_end_time: str | None = None
    barrier_exit_time: str | None = None
    barrier_entry_time: str | None = None
    remarks: str | None = None


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
    status: TourStatus | None = None
    base_id: int | None = None
    driver_name: str | None = None
    driver_arrival_time: str | None = None
    loading_end_time: str | None = None
    barrier_exit_time: str | None = None
    barrier_entry_time: str | None = None
    remarks: str | None = None


class TourOperationsUpdate(BaseModel):
    """Mise à jour exploitant / Operations update (driver, loading, remarks)."""
    driver_name: str | None = None
    driver_arrival_time: str | None = None
    loading_end_time: str | None = None
    remarks: str | None = None


class TourGateUpdate(BaseModel):
    """Mise à jour poste de garde / Gate update (barrier times)."""
    barrier_exit_time: str | None = None
    barrier_entry_time: str | None = None


class TourSchedule(BaseModel):
    """Planification : contrat + heure de départ / Schedule: contract + departure time."""
    contract_id: int
    departure_time: str  # HH:MM


class TourRead(TourBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    stops: list[TourStopRead] = []
