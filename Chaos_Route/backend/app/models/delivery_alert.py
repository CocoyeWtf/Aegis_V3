"""Modele Alertes livraison / Delivery alert model."""

import enum

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AlertType(str, enum.Enum):
    """Type d'alerte / Alert type."""
    WRONG_PDV = "WRONG_PDV"
    MISSING_SUPPORTS = "MISSING_SUPPORTS"
    UNEXPECTED_SUPPORT = "UNEXPECTED_SUPPORT"
    FORCED_CLOSURE = "FORCED_CLOSURE"
    LONG_STOP = "LONG_STOP"
    LONG_TRAVEL = "LONG_TRAVEL"
    NO_GPS = "NO_GPS"


class AlertSeverity(str, enum.Enum):
    """Severite de l'alerte / Alert severity."""
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class DeliveryAlert(Base):
    """Alertes livraison / Delivery alerts."""
    __tablename__ = "delivery_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), nullable=False)
    tour_stop_id: Mapped[int | None] = mapped_column(ForeignKey("tour_stops.id"))
    alert_type: Mapped[AlertType] = mapped_column(Enum(AlertType), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(25), nullable=False)  # ISO 8601
    acknowledged_at: Mapped[str | None] = mapped_column(String(25))
    acknowledged_by: Mapped[int | None] = mapped_column(Integer)  # user_id
    device_id: Mapped[int | None] = mapped_column(ForeignKey("mobile_devices.id"))
