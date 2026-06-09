"""Schémas Contrat (fusionné véhicule) / Contract schemas (merged with vehicle)."""

from pydantic import BaseModel, ConfigDict

from app.models.contract import FuelType, TailgateType, TemperatureType, VehicleType
from app.schemas.carrier import CarrierRead


class ContractScheduleBase(BaseModel):
    date: str  # YYYY-MM-DD
    is_available: bool = False


class ContractScheduleRead(ContractScheduleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    contract_id: int


class ContractBase(BaseModel):
    transporter_name: str
    code: str
    fixed_daily_cost: float | None = None
    vacation: float | None = None
    cost_per_km: float | None = None
    cost_per_hour: float | None = None
    # Barème pré-facturation CMRO
    trailer_cost: float | None = None
    ha_cost: float | None = None
    prime_saturday: float | None = None
    prime_sunday_holiday: float | None = None
    # Type de carburant : optionnel ici (Read tolère les anciens contrats),
    # rendu obligatoire dans ContractCreate.
    fuel_type: FuelType | None = None
    min_hours_per_day: float | None = None
    min_km_per_day: float | None = None
    consumption_coefficient: float | None = None  # L/km (gasoil) ou kg/km (gaz)
    start_date: str | None = None
    end_date: str | None = None
    region_id: int
    # Champs véhicule / Vehicle fields
    vehicle_code: str | None = None
    vehicle_name: str | None = None
    temperature_type: TemperatureType | None = None
    vehicle_type: VehicleType | None = None
    capacity_eqp: int | None = None
    capacity_weight_kg: int | None = None
    has_tailgate: bool = False
    tailgate_type: TailgateType | None = None
    provides_tractor: bool | None = None
    provides_trailer: bool | None = None
    vehicle_id: int | None = None
    carrier_id: int | None = None


class ContractCreate(ContractBase):
    fuel_type: FuelType  # obligatoire à la création (gasoil ou gaz)
    schedules: list[ContractScheduleBase] = []


class ContractUpdate(BaseModel):
    transporter_name: str | None = None
    code: str | None = None
    fixed_daily_cost: float | None = None
    vacation: float | None = None
    cost_per_km: float | None = None
    cost_per_hour: float | None = None
    trailer_cost: float | None = None
    ha_cost: float | None = None
    prime_saturday: float | None = None
    prime_sunday_holiday: float | None = None
    fuel_type: FuelType | None = None
    min_hours_per_day: float | None = None
    min_km_per_day: float | None = None
    consumption_coefficient: float | None = None
    start_date: str | None = None
    end_date: str | None = None
    region_id: int | None = None
    vehicle_code: str | None = None
    vehicle_name: str | None = None
    temperature_type: TemperatureType | None = None
    vehicle_type: VehicleType | None = None
    capacity_eqp: int | None = None
    capacity_weight_kg: int | None = None
    has_tailgate: bool | None = None
    tailgate_type: TailgateType | None = None
    provides_tractor: bool | None = None
    provides_trailer: bool | None = None
    vehicle_id: int | None = None
    carrier_id: int | None = None


class ContractRead(ContractBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    schedules: list[ContractScheduleRead] = []
    carrier: CarrierRead | None = None
