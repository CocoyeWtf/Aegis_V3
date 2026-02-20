"""Modele Position GPS chauffeur / Driver GPS position model."""

from sqlalchemy import Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GPSPosition(Base):
    """Position GPS chauffeur / Driver GPS position (~4800 rows/day for 30 phones)."""
    __tablename__ = "gps_positions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("mobile_devices.id"), nullable=False)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[float | None] = mapped_column(Float)
    speed: Mapped[float | None] = mapped_column(Float)
    timestamp: Mapped[str] = mapped_column(String(25), nullable=False)  # ISO 8601

    __table_args__ = (
        Index("ix_gps_positions_tour_timestamp", "tour_id", "timestamp"),
    )
