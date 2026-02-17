"""Modèle Contrat (fusionné avec véhicule) / Contract model (merged with vehicle)."""

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, Numeric, String
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


class Contract(Base):
    """1 contrat = 1 moyen (véhicule) mis à disposition / 1 contract = 1 vehicle provided."""
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Contrat / Contract
    transporter_name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    fixed_daily_cost: Mapped[float | None] = mapped_column(Numeric(10, 2))
    cost_per_km: Mapped[float | None] = mapped_column(Numeric(10, 4))
    cost_per_hour: Mapped[float | None] = mapped_column(Numeric(10, 2))
    min_hours_per_day: Mapped[float | None] = mapped_column(Numeric(5, 2))
    min_km_per_day: Mapped[float | None] = mapped_column(Numeric(8, 2))
    start_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD
    end_date: Mapped[str | None] = mapped_column(String(10))
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)

    # Véhicule / Vehicle
    vehicle_code: Mapped[str | None] = mapped_column(String(20), unique=True)
    vehicle_name: Mapped[str | None] = mapped_column(String(150))
    temperature_type: Mapped[TemperatureType | None] = mapped_column(Enum(TemperatureType))
    vehicle_type: Mapped[VehicleType | None] = mapped_column(Enum(VehicleType))
    capacity_eqp: Mapped[int | None] = mapped_column(Integer)
    capacity_weight_kg: Mapped[int | None] = mapped_column(Integer)
    has_tailgate: Mapped[bool] = mapped_column(Boolean, default=False)
    tailgate_type: Mapped[TailgateType | None] = mapped_column(Enum(TailgateType))

    # Relations
    region: Mapped["Region"] = relationship(back_populates="contracts")
    tours: Mapped[list["Tour"]] = relationship(back_populates="contract")
    schedules: Mapped[list["ContractSchedule"]] = relationship(
        back_populates="contract", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Contract {self.code} - {self.transporter_name}>"
