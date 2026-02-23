"""Modèle Tournée / Tour model."""

import enum

from sqlalchemy import Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.contract import VehicleType


class TourStatus(str, enum.Enum):
    """Statut de la tournée / Tour status."""
    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    IN_PROGRESS = "IN_PROGRESS"
    RETURNING = "RETURNING"
    COMPLETED = "COMPLETED"


class Tour(Base):
    __tablename__ = "tours"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    vehicle_type: Mapped[VehicleType | None] = mapped_column(Enum(VehicleType))
    capacity_eqp: Mapped[int | None] = mapped_column(Integer)
    contract_id: Mapped[int | None] = mapped_column(ForeignKey("contracts.id"), nullable=True)
    departure_time: Mapped[str | None] = mapped_column(String(5))  # HH:MM
    return_time: Mapped[str | None] = mapped_column(String(5))  # HH:MM
    total_km: Mapped[float | None] = mapped_column(Numeric(10, 2))
    total_duration_minutes: Mapped[int | None] = mapped_column(Integer)
    total_eqp: Mapped[int | None] = mapped_column(Integer)
    total_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    total_weight_kg: Mapped[float | None] = mapped_column(Numeric(10, 2))
    # Poids total du tour (saisi par le postier) / Total tour weight (entered by dispatcher)
    status: Mapped[TourStatus] = mapped_column(Enum(TourStatus), default=TourStatus.DRAFT)
    base_id: Mapped[int] = mapped_column(ForeignKey("bases_logistics.id"), nullable=False)
    delivery_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD — date de livraison

    # Champs opérationnels / Operational fields — datetime-local YYYY-MM-DDTHH:MM
    driver_name: Mapped[str | None] = mapped_column(String(100))
    driver_arrival_time: Mapped[str | None] = mapped_column(String(16))
    loading_end_time: Mapped[str | None] = mapped_column(String(16))
    barrier_exit_time: Mapped[str | None] = mapped_column(String(16))
    barrier_entry_time: Mapped[str | None] = mapped_column(String(16))
    km_departure: Mapped[int | None] = mapped_column(Integer)  # km compteur départ / odometer at departure
    km_return: Mapped[int | None] = mapped_column(Integer)  # km compteur retour / odometer at return
    remarks: Mapped[str | None] = mapped_column(Text)

    # Champs opérationnels postier / Dispatcher operational fields
    loader_code: Mapped[str | None] = mapped_column(String(20))
    loader_name: Mapped[str | None] = mapped_column(String(100))
    trailer_number: Mapped[str | None] = mapped_column(String(30))
    dock_door_number: Mapped[str | None] = mapped_column(String(10))
    trailer_ready_time: Mapped[str | None] = mapped_column(String(16))
    eqp_loaded: Mapped[int | None] = mapped_column(Integer)
    departure_signal_time: Mapped[str | None] = mapped_column(String(16))

    # Champs suivi mobile / Mobile tracking fields
    driver_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    device_assignment_id: Mapped[int | None] = mapped_column(ForeignKey("device_assignments.id"))
    actual_return_time: Mapped[str | None] = mapped_column(String(25))  # ISO 8601

    # Relations
    contract: Mapped["Contract | None"] = relationship(back_populates="tours")
    base: Mapped["BaseLogistics"] = relationship(back_populates="tours")
    stops: Mapped[list["TourStop"]] = relationship(
        back_populates="tour", cascade="all, delete-orphan", order_by="TourStop.sequence_order"
    )
    driver_user: Mapped["User | None"] = relationship(foreign_keys=[driver_user_id])
    device_assignment: Mapped["DeviceAssignment | None"] = relationship(foreign_keys=[device_assignment_id])

    def __repr__(self) -> str:
        return f"<Tour {self.code} - {self.date}>"
