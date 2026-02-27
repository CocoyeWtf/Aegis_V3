"""Schemas gestion de flotte / Fleet management schemas."""

from pydantic import BaseModel


# --- Maintenance ---

class MaintenanceRecordCreate(BaseModel):
    vehicle_id: int
    maintenance_type: str
    status: str = "SCHEDULED"
    description: str | None = None
    provider_name: str | None = None
    scheduled_date: str | None = None
    scheduled_km: int | None = None
    completed_date: str | None = None
    km_at_service: int | None = None
    cost_parts: float | None = None
    cost_labor: float | None = None
    cost_total: float | None = None
    invoice_ref: str | None = None
    inspection_id: int | None = None
    notes: str | None = None


class MaintenanceRecordUpdate(BaseModel):
    vehicle_id: int | None = None
    maintenance_type: str | None = None
    status: str | None = None
    description: str | None = None
    provider_name: str | None = None
    scheduled_date: str | None = None
    scheduled_km: int | None = None
    completed_date: str | None = None
    km_at_service: int | None = None
    cost_parts: float | None = None
    cost_labor: float | None = None
    cost_total: float | None = None
    invoice_ref: str | None = None
    inspection_id: int | None = None
    notes: str | None = None


class MaintenanceRecordRead(BaseModel):
    id: int
    vehicle_id: int
    maintenance_type: str
    status: str
    description: str | None = None
    provider_name: str | None = None
    scheduled_date: str | None = None
    scheduled_km: int | None = None
    completed_date: str | None = None
    km_at_service: int | None = None
    cost_parts: float | None = None
    cost_labor: float | None = None
    cost_total: float | None = None
    invoice_ref: str | None = None
    inspection_id: int | None = None
    notes: str | None = None
    created_at: str | None = None

    model_config = {"from_attributes": True}


# --- Schedule Rules ---

class ScheduleRuleCreate(BaseModel):
    label: str
    maintenance_type: str
    applicable_vehicle_types: str | None = None
    interval_km: int | None = None
    interval_months: int | None = None
    is_active: bool = True


class ScheduleRuleUpdate(BaseModel):
    label: str | None = None
    maintenance_type: str | None = None
    applicable_vehicle_types: str | None = None
    interval_km: int | None = None
    interval_months: int | None = None
    is_active: bool | None = None


class ScheduleRuleRead(BaseModel):
    id: int
    label: str
    maintenance_type: str
    applicable_vehicle_types: str | None = None
    interval_km: int | None = None
    interval_months: int | None = None
    is_active: bool

    model_config = {"from_attributes": True}


# --- Fuel ---

class FuelEntryCreate(BaseModel):
    vehicle_id: int
    date: str
    km_at_fill: int | None = None
    liters: float
    price_per_liter: float | None = None
    total_cost: float | None = None
    is_full_tank: bool = True
    station_name: str | None = None
    driver_name: str | None = None
    notes: str | None = None


class FuelEntryUpdate(BaseModel):
    vehicle_id: int | None = None
    date: str | None = None
    km_at_fill: int | None = None
    liters: float | None = None
    price_per_liter: float | None = None
    total_cost: float | None = None
    is_full_tank: bool | None = None
    station_name: str | None = None
    driver_name: str | None = None
    notes: str | None = None


class FuelEntryRead(BaseModel):
    id: int
    vehicle_id: int
    date: str
    km_at_fill: int | None = None
    liters: float
    price_per_liter: float | None = None
    total_cost: float | None = None
    is_full_tank: bool
    station_name: str | None = None
    driver_name: str | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


# --- Modifications ---

class ModificationCreate(BaseModel):
    vehicle_id: int
    date: str
    description: str
    cost: float | None = None
    provider_name: str | None = None
    invoice_ref: str | None = None
    notes: str | None = None


class ModificationUpdate(BaseModel):
    vehicle_id: int | None = None
    date: str | None = None
    description: str | None = None
    cost: float | None = None
    provider_name: str | None = None
    invoice_ref: str | None = None
    notes: str | None = None


class ModificationRead(BaseModel):
    id: int
    vehicle_id: int
    date: str
    description: str
    cost: float | None = None
    provider_name: str | None = None
    invoice_ref: str | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


# --- Cost Entries ---

class CostEntryCreate(BaseModel):
    vehicle_id: int
    category: str
    date: str
    description: str | None = None
    amount: float
    invoice_ref: str | None = None
    notes: str | None = None


class CostEntryUpdate(BaseModel):
    vehicle_id: int | None = None
    category: str | None = None
    date: str | None = None
    description: str | None = None
    amount: float | None = None
    invoice_ref: str | None = None
    notes: str | None = None


class CostEntryRead(BaseModel):
    id: int
    vehicle_id: int
    category: str
    date: str
    description: str | None = None
    amount: float
    invoice_ref: str | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


# --- TCO Dashboard ---

class VehicleTCOItem(BaseModel):
    """TCO pour un vehicule / TCO for one vehicle."""
    vehicle_id: int
    vehicle_code: str
    vehicle_name: str | None = None
    fleet_vehicle_type: str
    ownership_type: str | None = None
    lease_cost: float = 0
    depreciation_cost: float = 0
    maintenance_cost: float = 0
    fuel_cost: float = 0
    modification_cost: float = 0
    other_costs: float = 0
    total_cost: float = 0
    total_km: int = 0
    cost_per_km: float | None = None


class FleetDashboardResponse(BaseModel):
    """Donnees dashboard TCO flotte / Fleet TCO dashboard data."""
    vehicles: list[VehicleTCOItem] = []
    total_fleet_cost: float = 0
    total_fleet_km: int = 0
    avg_cost_per_km: float | None = None
