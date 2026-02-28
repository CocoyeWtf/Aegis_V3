"""Schemas vehicule / Vehicle schemas."""

from pydantic import BaseModel


class VehicleCreate(BaseModel):
    """Creation vehicule / Create vehicle."""
    code: str
    name: str | None = None
    license_plate: str | None = None
    vin: str | None = None
    brand: str | None = None
    model: str | None = None
    fleet_vehicle_type: str  # TRACTEUR, SEMI_REMORQUE, PORTEUR, REMORQUE, VL
    status: str = "ACTIVE"
    fuel_type: str | None = None
    temperature_type: str | None = None
    capacity_eqp: int | None = None
    capacity_weight_kg: int | None = None
    has_tailgate: bool = False
    tailgate_type: str | None = None
    first_registration_date: str | None = None
    acquisition_date: str | None = None
    disposal_date: str | None = None
    current_km: int | None = None
    ownership_type: str | None = None
    lessor_name: str | None = None
    lease_start_date: str | None = None
    lease_end_date: str | None = None
    monthly_lease_cost: float | None = None
    lease_contract_ref: str | None = None
    purchase_price: float | None = None
    depreciation_years: int | None = 5
    residual_value: float | None = None
    insurance_company: str | None = None
    insurance_policy_number: str | None = None
    insurance_start_date: str | None = None
    insurance_end_date: str | None = None
    insurance_annual_cost: float | None = None
    last_technical_inspection_date: str | None = None
    next_technical_inspection_date: str | None = None
    tachograph_type: str | None = None
    tachograph_next_calibration: str | None = None
    region_id: int | None = None
    notes: str | None = None


class VehicleUpdate(BaseModel):
    """Mise a jour vehicule / Update vehicle."""
    code: str | None = None
    name: str | None = None
    license_plate: str | None = None
    vin: str | None = None
    brand: str | None = None
    model: str | None = None
    fleet_vehicle_type: str | None = None
    status: str | None = None
    fuel_type: str | None = None
    temperature_type: str | None = None
    capacity_eqp: int | None = None
    capacity_weight_kg: int | None = None
    has_tailgate: bool | None = None
    tailgate_type: str | None = None
    first_registration_date: str | None = None
    acquisition_date: str | None = None
    disposal_date: str | None = None
    current_km: int | None = None
    last_km_update: str | None = None
    ownership_type: str | None = None
    lessor_name: str | None = None
    lease_start_date: str | None = None
    lease_end_date: str | None = None
    monthly_lease_cost: float | None = None
    lease_contract_ref: str | None = None
    purchase_price: float | None = None
    depreciation_years: int | None = None
    residual_value: float | None = None
    insurance_company: str | None = None
    insurance_policy_number: str | None = None
    insurance_start_date: str | None = None
    insurance_end_date: str | None = None
    insurance_annual_cost: float | None = None
    last_technical_inspection_date: str | None = None
    next_technical_inspection_date: str | None = None
    tachograph_type: str | None = None
    tachograph_next_calibration: str | None = None
    region_id: int | None = None
    notes: str | None = None


class VehicleRead(BaseModel):
    """Lecture vehicule / Read vehicle."""
    id: int
    code: str
    name: str | None = None
    license_plate: str | None = None
    vin: str | None = None
    brand: str | None = None
    model: str | None = None
    fleet_vehicle_type: str
    status: str
    fuel_type: str | None = None
    temperature_type: str | None = None
    capacity_eqp: int | None = None
    capacity_weight_kg: int | None = None
    has_tailgate: bool = False
    tailgate_type: str | None = None
    first_registration_date: str | None = None
    acquisition_date: str | None = None
    disposal_date: str | None = None
    current_km: int | None = None
    last_km_update: str | None = None
    ownership_type: str | None = None
    lessor_name: str | None = None
    lease_start_date: str | None = None
    lease_end_date: str | None = None
    monthly_lease_cost: float | None = None
    lease_contract_ref: str | None = None
    purchase_price: float | None = None
    depreciation_years: int | None = None
    residual_value: float | None = None
    insurance_company: str | None = None
    insurance_policy_number: str | None = None
    insurance_start_date: str | None = None
    insurance_end_date: str | None = None
    insurance_annual_cost: float | None = None
    last_technical_inspection_date: str | None = None
    next_technical_inspection_date: str | None = None
    tachograph_type: str | None = None
    tachograph_next_calibration: str | None = None
    region_id: int | None = None
    notes: str | None = None
    qr_code: str | None = None

    model_config = {"from_attributes": True}


class VehicleSummary(BaseModel):
    """Resume vehicule pour dropdown / Vehicle summary for dropdown."""
    id: int
    code: str
    name: str | None = None
    license_plate: str | None = None
    fleet_vehicle_type: str
    status: str
    qr_code: str | None = None

    model_config = {"from_attributes": True}
