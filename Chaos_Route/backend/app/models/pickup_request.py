"""Modèles Demande de reprise et Étiquette / Pickup request and label models."""

import enum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PickupType(str, enum.Enum):
    """Type de reprise / Pickup type."""
    CONTAINER = "CONTAINER"
    MERCHANDISE = "MERCHANDISE"
    CARDBOARD = "CARDBOARD"
    CONSIGNMENT = "CONSIGNMENT"  # Consignes bieres / Beer consignment


class PickupStatus(str, enum.Enum):
    """Statut de la demande / Request status."""
    REQUESTED = "REQUESTED"
    PLANNED = "PLANNED"
    PICKED_UP = "PICKED_UP"
    RECEIVED = "RECEIVED"


class LabelStatus(str, enum.Enum):
    """Statut d'une étiquette / Label status."""
    PENDING = "PENDING"
    PLANNED = "PLANNED"
    PICKED_UP = "PICKED_UP"
    RECEIVED = "RECEIVED"


class PickupRequest(Base):
    """Demande de reprise de contenants / Container pickup request."""
    __tablename__ = "pickup_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pdv_id: Mapped[int] = mapped_column(ForeignKey("pdvs.id"), nullable=False)
    support_type_id: Mapped[int] = mapped_column(ForeignKey("support_types.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # nombre d'unités
    availability_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    pickup_type: Mapped[PickupType] = mapped_column(Enum(PickupType), nullable=False, default=PickupType.CONTAINER)
    status: Mapped[PickupStatus] = mapped_column(Enum(PickupStatus), nullable=False, default=PickupStatus.REQUESTED)
    requested_at: Mapped[str | None] = mapped_column(DateTime, server_default=func.now())
    requested_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)

    # Relations
    pdv: Mapped["PDV"] = relationship()
    support_type: Mapped["SupportType"] = relationship()
    requested_by: Mapped["User | None"] = relationship()
    labels: Mapped[list["PickupLabel"]] = relationship(back_populates="pickup_request", cascade="all, delete-orphan")


class PickupLabel(Base):
    """Étiquette individuelle par unité / Individual label per unit."""
    __tablename__ = "pickup_labels"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pickup_request_id: Mapped[int] = mapped_column(ForeignKey("pickup_requests.id", ondelete="CASCADE"), nullable=False)
    label_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # RET-{PDV}-{SUPPORT}-{DATE}-{SEQ}
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-based
    status: Mapped[LabelStatus] = mapped_column(Enum(LabelStatus), nullable=False, default=LabelStatus.PENDING)
    tour_stop_id: Mapped[int | None] = mapped_column(ForeignKey("tour_stops.id"))
    picked_up_at: Mapped[str | None] = mapped_column(String(25))  # ISO 8601
    picked_up_device_id: Mapped[int | None] = mapped_column(ForeignKey("mobile_devices.id"))
    received_at: Mapped[str | None] = mapped_column(String(25))  # ISO 8601

    # Relations
    pickup_request: Mapped["PickupRequest"] = relationship(back_populates="labels")
