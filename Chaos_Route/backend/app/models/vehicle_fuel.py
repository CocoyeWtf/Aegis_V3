"""Modele suivi carburant / Fuel tracking model."""

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class VehicleFuelEntry(Base):
    """Entree carburant / Fuel entry."""
    __tablename__ = "vehicle_fuel_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    km_at_fill: Mapped[int | None] = mapped_column(Integer)
    liters: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    price_per_liter: Mapped[float | None] = mapped_column(Numeric(6, 4))
    total_cost: Mapped[float | None] = mapped_column(Numeric(10, 2))
    is_full_tank: Mapped[bool] = mapped_column(Boolean, default=True)
    station_name: Mapped[str | None] = mapped_column(String(100))
    driver_name: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)

    # Relations
    vehicle: Mapped["Vehicle"] = relationship(back_populates="fuel_entries")

    def __repr__(self) -> str:
        return f"<FuelEntry {self.date} - {self.liters}L - vehicle {self.vehicle_id}>"
