"""Modele Evenement arret / Stop event model."""

import enum

from sqlalchemy import Boolean, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StopEventType(str, enum.Enum):
    """Type d'evenement a un arret / Stop event type."""
    ARRIVAL = "ARRIVAL"
    DEPARTURE = "DEPARTURE"
    CLOSURE = "CLOSURE"


class StopEvent(Base):
    """Evenement a un arret (arrivee, depart, cloture) / Event at a stop."""
    __tablename__ = "stop_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tour_stop_id: Mapped[int] = mapped_column(ForeignKey("tour_stops.id"), nullable=False)
    event_type: Mapped[StopEventType] = mapped_column(Enum(StopEventType), nullable=False)
    scanned_pdv_code: Mapped[str | None] = mapped_column(String(50))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    accuracy: Mapped[float | None] = mapped_column(Float)
    timestamp: Mapped[str] = mapped_column(String(25), nullable=False)  # ISO 8601
    notes: Mapped[str | None] = mapped_column(Text)
    forced: Mapped[bool] = mapped_column(Boolean, default=False)
    device_id: Mapped[int | None] = mapped_column(ForeignKey("mobile_devices.id"))
