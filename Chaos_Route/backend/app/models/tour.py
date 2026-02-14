"""Modèle Tournée / Tour model."""

import enum

from sqlalchemy import Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TourStatus(str, enum.Enum):
    """Statut de la tournée / Tour status."""
    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class Tour(Base):
    __tablename__ = "tours"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    contract_id: Mapped[int | None] = mapped_column(ForeignKey("contracts.id"))
    departure_time: Mapped[str | None] = mapped_column(String(5))  # HH:MM
    return_time: Mapped[str | None] = mapped_column(String(5))  # HH:MM (RCAM)
    total_km: Mapped[float | None] = mapped_column(Numeric(10, 2))
    total_duration_minutes: Mapped[int | None] = mapped_column(Integer)
    total_eqp: Mapped[int | None] = mapped_column(Integer)
    total_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    status: Mapped[TourStatus] = mapped_column(Enum(TourStatus), default=TourStatus.DRAFT)
    base_id: Mapped[int] = mapped_column(ForeignKey("bases_logistics.id"), nullable=False)

    # Relations
    vehicle: Mapped["Vehicle"] = relationship(back_populates="tours")
    contract: Mapped["Contract | None"] = relationship(back_populates="tours")
    base: Mapped["BaseLogistics"] = relationship(back_populates="tours")
    stops: Mapped[list["TourStop"]] = relationship(
        back_populates="tour", cascade="all, delete-orphan", order_by="TourStop.sequence_order"
    )

    def __repr__(self) -> str:
        return f"<Tour {self.code} - {self.date}>"
