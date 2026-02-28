"""Modele Vehicule autonome / Standalone Vehicle model.

Entite physique du parc (tracteur, semi-remorque, porteur, remorque, VL).
Separee du Contract qui gere les couts du prestataire.
Physical fleet entity, separated from Contract which handles transporter costs.
"""

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.contract import TemperatureType, TailgateType


class FleetVehicleType(str, enum.Enum):
    """Type de vehicule flotte / Fleet vehicle type."""
    TRACTEUR = "TRACTEUR"
    SEMI_REMORQUE = "SEMI_REMORQUE"
    PORTEUR = "PORTEUR"
    REMORQUE = "REMORQUE"
    VL = "VL"
    # Legacy compat (anciennes valeurs Contract.vehicle_type)
    SEMI = "SEMI"
    PORTEUR_REMORQUE = "PORTEUR_REMORQUE"
    CITY = "CITY"


class VehicleStatus(str, enum.Enum):
    """Statut du vehicule / Vehicle status."""
    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"
    DISPOSED = "DISPOSED"


class FuelType(str, enum.Enum):
    """Type de carburant / Fuel type."""
    DIESEL = "DIESEL"
    ESSENCE = "ESSENCE"
    GNV = "GNV"
    ELECTRIQUE = "ELECTRIQUE"
    HYBRIDE = "HYBRIDE"


class OwnershipType(str, enum.Enum):
    """Mode de detention / Ownership mode."""
    OWNED = "OWNED"
    LEASED = "LEASED"
    RENTED = "RENTED"


class Vehicle(Base):
    """Vehicule du parc / Fleet vehicle."""
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # --- Identification ---
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(150))
    license_plate: Mapped[str | None] = mapped_column(String(20), unique=True)
    vin: Mapped[str | None] = mapped_column(String(30))
    brand: Mapped[str | None] = mapped_column(String(50))
    model: Mapped[str | None] = mapped_column(String(50))

    # --- Classification ---
    fleet_vehicle_type: Mapped[FleetVehicleType] = mapped_column(
        Enum(FleetVehicleType), nullable=False
    )
    status: Mapped[VehicleStatus] = mapped_column(
        Enum(VehicleStatus), default=VehicleStatus.ACTIVE
    )
    fuel_type: Mapped[FuelType | None] = mapped_column(Enum(FuelType))

    # --- Capacite (ex-Contract) / Capacity ---
    temperature_type: Mapped[TemperatureType | None] = mapped_column(Enum(TemperatureType))
    capacity_eqp: Mapped[int | None] = mapped_column(Integer)
    capacity_weight_kg: Mapped[int | None] = mapped_column(Integer)
    has_tailgate: Mapped[bool] = mapped_column(Boolean, default=False)
    tailgate_type: Mapped[TailgateType | None] = mapped_column(Enum(TailgateType))

    # --- Dates cles / Key dates ---
    first_registration_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD
    acquisition_date: Mapped[str | None] = mapped_column(String(10))
    disposal_date: Mapped[str | None] = mapped_column(String(10))

    # --- Kilometrage / Mileage ---
    current_km: Mapped[int | None] = mapped_column(Integer)
    last_km_update: Mapped[str | None] = mapped_column(String(32))  # ISO 8601

    # --- Detention / Ownership ---
    ownership_type: Mapped[OwnershipType | None] = mapped_column(Enum(OwnershipType))

    # --- Leasing / Location ---
    lessor_name: Mapped[str | None] = mapped_column(String(150))
    lease_start_date: Mapped[str | None] = mapped_column(String(10))
    lease_end_date: Mapped[str | None] = mapped_column(String(10))
    monthly_lease_cost: Mapped[float | None] = mapped_column(Numeric(10, 2))
    lease_contract_ref: Mapped[str | None] = mapped_column(String(50))

    # --- Amortissement / Depreciation ---
    purchase_price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    depreciation_years: Mapped[int | None] = mapped_column(Integer, default=5)
    residual_value: Mapped[float | None] = mapped_column(Numeric(12, 2))

    # --- Assurance / Insurance ---
    insurance_company: Mapped[str | None] = mapped_column(String(150))
    insurance_policy_number: Mapped[str | None] = mapped_column(String(50))
    insurance_start_date: Mapped[str | None] = mapped_column(String(10))
    insurance_end_date: Mapped[str | None] = mapped_column(String(10))
    insurance_annual_cost: Mapped[float | None] = mapped_column(Numeric(10, 2))

    # --- Reglementaire / Regulatory ---
    last_technical_inspection_date: Mapped[str | None] = mapped_column(String(10))
    next_technical_inspection_date: Mapped[str | None] = mapped_column(String(10))
    tachograph_type: Mapped[str | None] = mapped_column(String(30))  # ANALOG|DIGITAL|SMART
    tachograph_next_calibration: Mapped[str | None] = mapped_column(String(10))

    # --- Rattachement / Home region ---
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id"))

    # --- Notes ---
    notes: Mapped[str | None] = mapped_column(Text)

    # --- Relations ---
    region: Mapped["Region"] = relationship()
    contracts: Mapped[list["Contract"]] = relationship(back_populates="vehicle")
    inspections: Mapped[list["VehicleInspection"]] = relationship(back_populates="vehicle")
    maintenances: Mapped[list["VehicleMaintenanceRecord"]] = relationship(back_populates="vehicle")
    fuel_entries: Mapped[list["VehicleFuelEntry"]] = relationship(back_populates="vehicle")
    modifications: Mapped[list["VehicleModification"]] = relationship(back_populates="vehicle")
    cost_entries: Mapped[list["VehicleCostEntry"]] = relationship(back_populates="vehicle")

    def __repr__(self) -> str:
        return f"<Vehicle {self.code} - {self.name or self.license_plate}>"
