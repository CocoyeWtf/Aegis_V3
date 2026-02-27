"""Modele couts divers vehicule / Vehicle miscellaneous cost model."""

import enum

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CostCategory(str, enum.Enum):
    """Categorie de cout / Cost category."""
    INSURANCE = "INSURANCE"
    TAX = "TAX"
    FINE = "FINE"
    TOLL = "TOLL"
    PARKING = "PARKING"
    OTHER = "OTHER"


class VehicleCostEntry(Base):
    """Cout divers vehicule / Vehicle miscellaneous cost."""
    __tablename__ = "vehicle_cost_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    category: Mapped[CostCategory] = mapped_column(Enum(CostCategory), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    description: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    invoice_ref: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)

    # Relations
    vehicle: Mapped["Vehicle"] = relationship(back_populates="cost_entries")

    def __repr__(self) -> str:
        return f"<VehicleCostEntry {self.category.value} {self.amount} - vehicle {self.vehicle_id}>"
