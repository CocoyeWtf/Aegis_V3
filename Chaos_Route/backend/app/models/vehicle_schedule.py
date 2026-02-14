"""Modèle Planning véhicule / Vehicle schedule model."""

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class VehicleSchedule(Base):
    __tablename__ = "vehicle_schedules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday ... 6=Sunday
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relations
    vehicle: Mapped["Vehicle"] = relationship(back_populates="schedules")

    def __repr__(self) -> str:
        return f"<VehicleSchedule vehicle={self.vehicle_id} day={self.day_of_week}>"
