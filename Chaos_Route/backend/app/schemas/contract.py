"""Schémas Contrat / Contract schemas."""

from pydantic import BaseModel, ConfigDict


class ContractBase(BaseModel):
    transporter_name: str
    code: str
    fixed_daily_cost: float | None = None
    cost_per_km: float | None = None
    cost_per_hour: float | None = None
    min_hours_per_day: float | None = None
    min_km_per_day: float | None = None
    start_date: str | None = None
    end_date: str | None = None
    region_id: int


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    transporter_name: str | None = None
    code: str | None = None
    fixed_daily_cost: float | None = None
    cost_per_km: float | None = None
    cost_per_hour: float | None = None
    min_hours_per_day: float | None = None
    min_km_per_day: float | None = None
    start_date: str | None = None
    end_date: str | None = None
    region_id: int | None = None


class ContractRead(ContractBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
