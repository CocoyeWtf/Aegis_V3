"""Modele Alerte Operationnelle / Operational Alert model.

File d'alertes pour le passage d'information entre equipes.
Alert queue for team handoff and operational awareness.
"""

import enum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AlertType(str, enum.Enum):
    """Type d'alerte / Alert type."""
    VOLUMES_RELEASED = "VOLUMES_RELEASED"      # Volumes retires d'un tour
    STOP_ADDED = "STOP_ADDED"                  # PDV ajoute a un tour
    TOUR_MODIFIED = "TOUR_MODIFIED"            # Tour modifie en live
    CAPACITY_WARNING = "CAPACITY_WARNING"      # Depassement capacite
    DELIVERY_WINDOW = "DELIVERY_WINDOW"        # Fenetre de livraison depassee
    CUSTOM = "CUSTOM"                          # Alerte manuelle


class AlertStatus(str, enum.Enum):
    """Statut de l'alerte / Alert status."""
    PENDING = "PENDING"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class AlertPriority(str, enum.Enum):
    """Priorite / Priority."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class OperationalAlert(Base):
    """Alerte operationnelle / Operational alert."""
    __tablename__ = "operational_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Classification
    alert_type: Mapped[AlertType] = mapped_column(Enum(AlertType), nullable=False)
    status: Mapped[AlertStatus] = mapped_column(Enum(AlertStatus), default=AlertStatus.PENDING)
    priority: Mapped[AlertPriority] = mapped_column(Enum(AlertPriority), default=AlertPriority.MEDIUM)

    # Contenu / Content
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)

    # Contexte / Context
    tour_id: Mapped[int | None] = mapped_column(Integer)
    tour_code: Mapped[str | None] = mapped_column(String(50))
    pdv_id: Mapped[int | None] = mapped_column(Integer)
    pdv_code: Mapped[str | None] = mapped_column(String(20))
    base_id: Mapped[int | None] = mapped_column(Integer)
    date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD
    freed_eqp: Mapped[float | None] = mapped_column(Integer)
    extra_data: Mapped[str | None] = mapped_column(Text)  # JSON pour données additionnelles

    # Auteur / Author
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_by_name: Mapped[str | None] = mapped_column(String(150))
    created_at: Mapped[str | None] = mapped_column(DateTime, server_default=func.now())

    # Resolution
    resolved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolved_by_name: Mapped[str | None] = mapped_column(String(150))
    resolved_at: Mapped[str | None] = mapped_column(DateTime)

    # Relations
    comments: Mapped[list["AlertComment"]] = relationship(
        back_populates="alert", cascade="all, delete-orphan",
        order_by="AlertComment.created_at",
    )

    def __repr__(self) -> str:
        return f"<Alert {self.id} [{self.alert_type.value}] {self.status.value}>"


class AlertComment(Base):
    """Commentaire sur alerte / Alert comment."""
    __tablename__ = "alert_comments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("operational_alerts.id"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    user_name: Mapped[str | None] = mapped_column(String(150))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str | None] = mapped_column(DateTime, server_default=func.now())

    alert: Mapped["OperationalAlert"] = relationship(back_populates="comments")
