"""Schémas PDV / Point of Sale schemas."""

from pydantic import BaseModel, ConfigDict

from app.models.pdv import PDVType


class PDVBase(BaseModel):
    code: str
    name: str
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    phone: str | None = None
    email: str | None = None
    longitude: float | None = None
    latitude: float | None = None
    type: PDVType
    has_sas: bool = False
    sas_capacity: int | None = None
    has_dock: bool = False
    dock_has_niche: bool = False
    dock_time_minutes: int | None = None
    unload_time_per_eqp_minutes: int | None = None
    delivery_window_start: str | None = None
    delivery_window_end: str | None = None
    access_constraints: str | None = None
    region_id: int


class PDVCreate(PDVBase):
    pass


class PDVUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    phone: str | None = None
    email: str | None = None
    longitude: float | None = None
    latitude: float | None = None
    type: PDVType | None = None
    has_sas: bool | None = None
    sas_capacity: int | None = None
    has_dock: bool | None = None
    dock_has_niche: bool | None = None
    dock_time_minutes: int | None = None
    unload_time_per_eqp_minutes: int | None = None
    delivery_window_start: str | None = None
    delivery_window_end: str | None = None
    access_constraints: str | None = None
    region_id: int | None = None


class PDVRead(PDVBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
