"""Schémas Filiale/CNUF → type température / CNUF/Filiale temperature mapping schemas."""

from pydantic import BaseModel, ConfigDict


class CnufTemperatureBase(BaseModel):
    cnuf: str
    filiale: str
    temperature_type: str  # SEC, FRAIS, GEL, FFL
    label: str | None = None
    base_id: int | None = None


class CnufTemperatureCreate(CnufTemperatureBase):
    pass


class CnufTemperatureUpdate(BaseModel):
    cnuf: str | None = None
    filiale: str | None = None
    temperature_type: str | None = None
    label: str | None = None
    base_id: int | None = None


class CnufTemperatureRead(CnufTemperatureBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
