"""Schémas Région / Region schemas."""

from pydantic import BaseModel, ConfigDict


class RegionBase(BaseModel):
    name: str
    country_id: int


class RegionCreate(RegionBase):
    pass


class RegionUpdate(BaseModel):
    name: str | None = None
    country_id: int | None = None


class RegionRead(RegionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
