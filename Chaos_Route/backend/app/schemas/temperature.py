"""Schemas controle temperature / Temperature check schemas."""

from pydantic import BaseModel, ConfigDict


class TemperatureCheckCreate(BaseModel):
    tour_id: int
    tour_stop_id: int | None = None
    checkpoint: str       # TRAILER_ARRIVAL, TRAILER_BEFORE_LOADING, etc.
    temperature: float
    setpoint_temperature: float | None = None
    cooling_unit_ok: bool | None = None
    device_id: int | None = None
    notes: str | None = None


class TemperatureCheckRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tour_id: int
    tour_stop_id: int | None = None
    checkpoint: str
    temperature: float
    setpoint_temperature: float | None = None
    cooling_unit_ok: bool | None = None
    device_id: int | None = None
    user_id: int | None = None
    timestamp: str
    notes: str | None = None
    photo_path: str | None = None
    # Enrichi
    is_compliant: bool | None = None  # Dans les seuils ?
    stop_pdv_name: str | None = None


class TemperatureConfigCreate(BaseModel):
    name: str
    min_temperature: float
    max_temperature: float
    default_setpoint: float | None = None
    requires_cooling_check: bool = True


class TemperatureConfigRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    min_temperature: float
    max_temperature: float
    default_setpoint: float | None = None
    requires_cooling_check: bool


class TourTemperatureSummary(BaseModel):
    """Resume temperature d'une tournee / Tour temperature summary."""
    tour_id: int
    total_checks: int
    compliant_checks: int
    non_compliant_checks: int
    checks: list[TemperatureCheckRead]
