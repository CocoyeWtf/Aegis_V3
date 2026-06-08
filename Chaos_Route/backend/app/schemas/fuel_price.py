"""Schémas Prix carburant / Fuel price schemas."""

from pydantic import BaseModel, ConfigDict

from app.models.fuel_price import FuelType


class FuelPriceBase(BaseModel):
    # Défaut DIESEL (gasoil) pour que la lecture des anciennes lignes reste valide
    fuel_type: FuelType = FuelType.DIESEL
    start_date: str
    end_date: str
    price_per_liter: float  # €/L (gasoil) ou €/kg (gaz)


class FuelPriceCreate(FuelPriceBase):
    fuel_type: FuelType  # requis à la création (pas de défaut)


class FuelPriceUpdate(BaseModel):
    fuel_type: FuelType | None = None
    start_date: str | None = None
    end_date: str | None = None
    price_per_liter: float | None = None


class FuelPriceRead(FuelPriceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
