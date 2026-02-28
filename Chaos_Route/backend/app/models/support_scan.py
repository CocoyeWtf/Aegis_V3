"""Modele Scan support individuel / Individual support scan model."""

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SupportScan(Base):
    """Scan support individuel (code barre 1D) / Individual support scan (1D barcode)."""
    __tablename__ = "support_scans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tour_stop_id: Mapped[int] = mapped_column(ForeignKey("tour_stops.id"), nullable=False)
    device_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("mobile_devices.id"))
    barcode: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    timestamp: Mapped[str] = mapped_column(String(32), nullable=False)  # ISO 8601
    expected_at_stop: Mapped[bool] = mapped_column(Boolean, default=True)
