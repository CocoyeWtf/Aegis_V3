"""Modèle Véhicule / Vehicle model."""

import enum

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TemperatureType(str, enum.Enum):
    """Type de température du véhicule / Vehicle temperature type."""
    GEL = "GEL"
    FRAIS = "FRAIS"
    SEC = "SEC"
    BI_TEMP = "BI_TEMP"
    TRI_TEMP = "TRI_TEMP"


class VehicleType(str, enum.Enum):
    """Type de véhicule / Vehicle type."""
    SEMI = "SEMI"
    PORTEUR = "PORTEUR"
    PORTEUR_REMORQUE = "PORTEUR_REMORQUE"
    CITY = "CITY"
    VL = "VL"


class TailgateType(str, enum.Enum):
    """Type de hayon / Tailgate type."""
    RETRACTABLE = "RETRACTABLE"
    RABATTABLE = "RABATTABLE"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    temperature_type: Mapped[TemperatureType] = mapped_column(Enum(TemperatureType), nullable=False)
    vehicle_type: Mapped[VehicleType] = mapped_column(Enum(VehicleType), nullable=False)
    capacity_eqp: Mapped[int] = mapped_column(Integer, nullable=False)
    capacity_weight_kg: Mapped[int | None] = mapped_column(Integer)
    fixed_cost: Mapped[float | None] = mapped_column(Numeric(10, 2))  # terme fixe journalier
    cost_per_km: Mapped[float | None] = mapped_column(Numeric(10, 4))
    has_tailgate: Mapped[bool] = mapped_column(Boolean, default=False)  # hayon
    tailgate_type: Mapped[TailgateType | None] = mapped_column(Enum(TailgateType))
    contract_start_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD
    contract_end_date: Mapped[str | None] = mapped_column(String(10))
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)

    # Relations
    region: Mapped["Region"] = relationship(back_populates="vehicles")
    schedules: Mapped[list["VehicleSchedule"]] = relationship(back_populates="vehicle", cascade="all, delete-orphan")
    tours: Mapped[list["Tour"]] = relationship(back_populates="vehicle")

    def __repr__(self) -> str:
        return f"<Vehicle {self.code} - {self.name}>"
