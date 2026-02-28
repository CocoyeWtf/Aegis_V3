"""Modele declarations chauffeur (anomalies, casse, accidents) / Driver declaration model."""

import enum

from sqlalchemy import Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DeclarationType(str, enum.Enum):
    """Type de declaration / Declaration type."""
    ANOMALY = "ANOMALY"
    BREAKAGE = "BREAKAGE"
    ACCIDENT = "ACCIDENT"
    VEHICLE_ISSUE = "VEHICLE_ISSUE"
    CLIENT_ISSUE = "CLIENT_ISSUE"
    OTHER = "OTHER"


class DriverDeclaration(Base):
    """Declarations chauffeur / Driver declarations."""
    __tablename__ = "driver_declarations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("mobile_devices.id"), nullable=False)
    tour_id: Mapped[int | None] = mapped_column(ForeignKey("tours.id"))
    tour_stop_id: Mapped[int | None] = mapped_column(ForeignKey("tour_stops.id"))
    declaration_type: Mapped[DeclarationType] = mapped_column(Enum(DeclarationType), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    accuracy: Mapped[float | None] = mapped_column(Float)
    driver_name: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[str] = mapped_column(String(32), nullable=False)  # ISO 8601


class DeclarationPhoto(Base):
    """Photos attachees aux declarations / Photos attached to declarations."""
    __tablename__ = "declaration_photos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    declaration_id: Mapped[int] = mapped_column(ForeignKey("driver_declarations.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer)
    mime_type: Mapped[str | None] = mapped_column(String(50))
    uploaded_at: Mapped[str] = mapped_column(String(32), nullable=False)  # ISO 8601
