"""Schémas Prix du gasoil / Fuel price schemas."""

from pydantic import BaseModel, ConfigDict


class FuelPriceBase(BaseModel):
    start_date: str
    end_date: str
    price_per_liter: float


class FuelPriceCreate(FuelPriceBase):
    pass


class FuelPriceUpdate(BaseModel):
    start_date: str | None = None
    end_date: str | None = None
    price_per_liter: float | None = None


class FuelPriceRead(FuelPriceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
