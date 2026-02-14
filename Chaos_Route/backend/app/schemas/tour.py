"""Schémas Tour / Tour schemas."""

from pydantic import BaseModel, ConfigDict

from app.models.tour import TourStatus


class TourStopBase(BaseModel):
    pdv_id: int
    sequence_order: int
    eqp_count: int
    arrival_time: str | None = None
    departure_time: str | None = None
    distance_from_previous_km: float | None = None
    duration_from_previous_minutes: int | None = None


class TourStopCreate(TourStopBase):
    pass


class TourStopRead(TourStopBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tour_id: int


class TourBase(BaseModel):
    date: str
    code: str
    vehicle_id: int
    contract_id: int | None = None
    departure_time: str | None = None
    return_time: str | None = None
    total_km: float | None = None
    total_duration_minutes: int | None = None
    total_eqp: int | None = None
    total_cost: float | None = None
    status: TourStatus = TourStatus.DRAFT
    base_id: int


class TourCreate(TourBase):
    stops: list[TourStopCreate] = []


class TourUpdate(BaseModel):
    date: str | None = None
    code: str | None = None
    vehicle_id: int | None = None
    contract_id: int | None = None
    departure_time: str | None = None
    return_time: str | None = None
    total_km: float | None = None
    total_duration_minutes: int | None = None
    total_eqp: int | None = None
    total_cost: float | None = None
    status: TourStatus | None = None
    base_id: int | None = None


class TourRead(TourBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    stops: list[TourStopRead] = []
