"""Modele modification vehicule / Vehicle modification model."""

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class VehicleModification(Base):
    """Modification apportee au vehicule / Modification applied to vehicle."""
    __tablename__ = "vehicle_modifications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    description: Mapped[str] = mapped_column(Text, nullable=False)
    cost: Mapped[float | None] = mapped_column(Numeric(10, 2))
    provider_name: Mapped[str | None] = mapped_column(String(150))
    invoice_ref: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)

    # Relations
    vehicle: Mapped["Vehicle"] = relationship(back_populates="modifications")

    def __repr__(self) -> str:
        return f"<VehicleModification {self.date} - vehicle {self.vehicle_id}>"
