"""Schémas Volume / Volume schemas."""

from pydantic import BaseModel, ConfigDict

from app.models.volume import TemperatureClass


class VolumeBase(BaseModel):
    pdv_id: int
    date: str
    nb_colis: int | None = None
    eqp_count: int
    weight_kg: float | None = None
    temperature_class: TemperatureClass
    base_origin_id: int
    preparation_start: str | None = None
    preparation_end: str | None = None


class VolumeCreate(VolumeBase):
    pass


class VolumeUpdate(BaseModel):
    pdv_id: int | None = None
    date: str | None = None
    nb_colis: int | None = None
    eqp_count: int | None = None
    weight_kg: float | None = None
    temperature_class: TemperatureClass | None = None
    base_origin_id: int | None = None
    preparation_start: str | None = None
    preparation_end: str | None = None


class VolumeRead(VolumeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tour_id: int | None = None


class VolumeSplit(BaseModel):
    """Quantité EQP à garder dans ce volume / EQP count to keep in this volume."""
    eqp_count: int
