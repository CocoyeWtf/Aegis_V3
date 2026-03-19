"""Controle temperature chaine du froid / Cold chain temperature check model.
Releves temperature semi-remorque (base) et groupe froid (chauffeur).
"""

import enum

from sqlalchemy import Column, Enum, Float, ForeignKey, Index, Integer, String, Text, Boolean
from app.database import Base


class TempCheckpoint(str, enum.Enum):
    """Point de controle temperature / Temperature checkpoint."""
    TRAILER_ARRIVAL = "TRAILER_ARRIVAL"          # Arrivee semi sur base
    TRAILER_BEFORE_LOADING = "TRAILER_BEFORE_LOADING"  # Avant chargement
    TRAILER_AFTER_LOADING = "TRAILER_AFTER_LOADING"    # Fin de chargement
    DEPARTURE_CHECK = "DEPARTURE_CHECK"          # Check depart chauffeur (groupe froid)
    STOP_CHECK = "STOP_CHECK"                    # Check a chaque stop


class TemperatureCheck(Base):
    """Releve de temperature chaine du froid / Cold chain temperature check."""
    __tablename__ = "temperature_checks"
    __table_args__ = (
        Index("ix_tempcheck_tour", "tour_id"),
        Index("ix_tempcheck_timestamp", "timestamp"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tour_id = Column(Integer, ForeignKey("tours.id"), nullable=False)
    tour_stop_id = Column(Integer, ForeignKey("tour_stops.id"), nullable=True)  # Pour STOP_CHECK
    checkpoint = Column(Enum(TempCheckpoint), nullable=False)
    # Temperature
    temperature = Column(Float, nullable=False)             # Temperature relevee (°C)
    setpoint_temperature = Column(Float, nullable=True)     # Consigne temperature (°C)
    # Groupe froid / Cooling unit
    cooling_unit_ok = Column(Boolean, nullable=True)        # Groupe froid fonctionne ?
    # Meta
    device_id = Column(Integer, ForeignKey("mobile_devices.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    timestamp = Column(String(32), nullable=False)  # ISO 8601
    notes = Column(Text, nullable=True)
    # Photo preuve (optionnel) / Proof photo (optional)
    photo_path = Column(String(255), nullable=True)


class TemperatureConfig(Base):
    """Configuration seuils temperature par classe / Temperature thresholds per class."""
    __tablename__ = "temperature_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)       # ex: "FRAIS", "GEL", "SURGELE"
    min_temperature = Column(Float, nullable=False)               # Seuil min (°C)
    max_temperature = Column(Float, nullable=False)               # Seuil max (°C)
    default_setpoint = Column(Float, nullable=True)               # Consigne par defaut
    requires_cooling_check = Column(Boolean, nullable=False, default=True)
