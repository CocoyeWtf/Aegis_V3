"""Schémas Véhicule / Vehicle schemas."""

from pydantic import BaseModel, ConfigDict

from app.models.vehicle import TailgateType, TemperatureType, VehicleType


class VehicleBase(BaseModel):
    code: str
    name: str
    temperature_type: TemperatureType
    vehicle_type: VehicleType
    capacity_eqp: int
    capacity_weight_kg: int | None = None
    fixed_cost: float | None = None
    cost_per_km: float | None = None
    has_tailgate: bool = False
    tailgate_type: TailgateType | None = None
    contract_start_date: str | None = None
    contract_end_date: str | None = None
    region_id: int


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    temperature_type: TemperatureType | None = None
    vehicle_type: VehicleType | None = None
    capacity_eqp: int | None = None
    capacity_weight_kg: int | None = None
    fixed_cost: float | None = None
    cost_per_km: float | None = None
    has_tailgate: bool | None = None
    tailgate_type: TailgateType | None = None
    contract_start_date: str | None = None
    contract_end_date: str | None = None
    region_id: int | None = None


class VehicleRead(VehicleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
