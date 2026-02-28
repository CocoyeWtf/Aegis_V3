"""Modele entretien vehicule / Vehicle maintenance model."""

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MaintenanceType(str, enum.Enum):
    """Type d'entretien / Maintenance type."""
    OIL_CHANGE = "OIL_CHANGE"
    BRAKE_SERVICE = "BRAKE_SERVICE"
    TIRE_REPLACEMENT = "TIRE_REPLACEMENT"
    TECHNICAL_INSPECTION = "TECHNICAL_INSPECTION"
    TACHOGRAPH_CALIBRATION = "TACHOGRAPH_CALIBRATION"
    REFRIGERATION_SERVICE = "REFRIGERATION_SERVICE"
    GENERAL_SERVICE = "GENERAL_SERVICE"
    REPAIR = "REPAIR"
    BODYWORK = "BODYWORK"
    OTHER = "OTHER"


class MaintenanceStatus(str, enum.Enum):
    """Statut entretien / Maintenance status."""
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class VehicleMaintenanceRecord(Base):
    """Enregistrement entretien / Maintenance record."""
    __tablename__ = "vehicle_maintenance_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    maintenance_type: Mapped[MaintenanceType] = mapped_column(Enum(MaintenanceType), nullable=False)
    status: Mapped[MaintenanceStatus] = mapped_column(
        Enum(MaintenanceStatus), default=MaintenanceStatus.SCHEDULED
    )
    description: Mapped[str | None] = mapped_column(Text)
    provider_name: Mapped[str | None] = mapped_column(String(150))

    # Planning
    scheduled_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD
    scheduled_km: Mapped[int | None] = mapped_column(Integer)
    completed_date: Mapped[str | None] = mapped_column(String(10))
    km_at_service: Mapped[int | None] = mapped_column(Integer)

    # Couts / Costs
    cost_parts: Mapped[float | None] = mapped_column(Numeric(10, 2))
    cost_labor: Mapped[float | None] = mapped_column(Numeric(10, 2))
    cost_total: Mapped[float | None] = mapped_column(Numeric(10, 2))
    invoice_ref: Mapped[str | None] = mapped_column(String(50))

    # Lien inspection declencheuse / Linked triggering inspection
    inspection_id: Mapped[int | None] = mapped_column(ForeignKey("vehicle_inspections.id"))

    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str | None] = mapped_column(String(32))  # ISO 8601

    # Relations
    vehicle: Mapped["Vehicle"] = relationship(back_populates="maintenances")

    def __repr__(self) -> str:
        return f"<Maintenance {self.maintenance_type.value} - vehicle {self.vehicle_id}>"


class MaintenanceScheduleRule(Base):
    """Regle de planification entretien / Maintenance scheduling rule.

    Ex: vidange tous les 30 000 km OU tous les 12 mois.
    Ex: oil change every 30,000 km OR every 12 months.
    """
    __tablename__ = "maintenance_schedule_rules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    maintenance_type: Mapped[MaintenanceType] = mapped_column(Enum(MaintenanceType), nullable=False)
    applicable_vehicle_types: Mapped[str | None] = mapped_column(String(200))
    interval_km: Mapped[int | None] = mapped_column(Integer)
    interval_months: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def __repr__(self) -> str:
        return f"<ScheduleRule {self.label}>"
