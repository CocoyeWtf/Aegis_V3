"""Modèles Demande de reprise, Étiquette et Mouvement / Pickup request, label and movement models."""

import enum

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, Numeric, String, Text, func
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


class MovementType(str, enum.Enum):
    """Type de mouvement contenant / Container movement type."""
    REQUESTED = "REQUESTED"        # Demande PDV créée
    PLANNED = "PLANNED"            # Affecté à un tour
    PICKED_UP = "PICKED_UP"        # Repris par chauffeur
    RECEIVED = "RECEIVED"          # Réceptionné sur base
    REFUSED = "REFUSED"            # Refusé par chauffeur
    UNLINKED = "UNLINKED"          # Délié du tour


class PickupRequest(Base):
    """Demande de reprise de contenants / Container pickup request."""
    __tablename__ = "pickup_requests"
    __table_args__ = (
        Index("ix_pickup_requests_pdv_id", "pdv_id"),
        Index("ix_pickup_requests_status", "status"),
        Index("ix_pickup_requests_availability", "availability_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pdv_id: Mapped[int] = mapped_column(ForeignKey("pdvs.id"), nullable=False)
    support_type_id: Mapped[int | None] = mapped_column(ForeignKey("support_types.id"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # nombre d'unités
    availability_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    pickup_type: Mapped[PickupType] = mapped_column(Enum(PickupType), nullable=False, default=PickupType.CONTAINER)
    status: Mapped[PickupStatus] = mapped_column(Enum(PickupStatus), nullable=False, default=PickupStatus.REQUESTED)
    requested_at: Mapped[str | None] = mapped_column(DateTime, server_default=func.now())
    requested_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)

    # Consigne : contenu inclus (ex: bouteilles vides dans les bacs)
    # Consignment: content included (e.g., empty bottles in the crates)
    with_content: Mapped[bool] = mapped_column(Boolean, default=False)
    # Snapshots valeur au moment de la déclaration — immuables si les tarifs changent
    # Value snapshots at declaration time — immutable if rates change later
    declared_unit_value: Mapped[float | None] = mapped_column(Numeric(10, 2))
    declared_unit_quantity: Mapped[int | None] = mapped_column(Integer)   # nb caisses/pièces par unité
    declared_content_item_value: Mapped[float | None] = mapped_column(Numeric(10, 4))
    declared_content_items_per_unit: Mapped[int | None] = mapped_column(Integer)

    # Relations
    pdv: Mapped["PDV"] = relationship()
    support_type: Mapped["SupportType"] = relationship()
    requested_by: Mapped["User | None"] = relationship()
    labels: Mapped[list["PickupLabel"]] = relationship(back_populates="pickup_request", cascade="all, delete-orphan")

    @property
    def total_declared_value(self) -> float | None:
        """Valeur totale de la consigne déclarée / Total declared consignment value.
        quantity × unit_quantity × (unit_value + with_content × content_items_per_unit × content_item_value)
        Ex: 2 palettes × 50 bacs × (2.10 + 24 × 0.10) = 2 × 50 × 4.50 = 450.00 €
        """
        if self.declared_unit_value is None:
            return None
        unit_qty = self.declared_unit_quantity or 1  # rétrocompat si NULL/0
        content_val = 0.0
        if (self.with_content
                and self.declared_content_item_value is not None
                and self.declared_content_items_per_unit is not None):
            content_val = float(self.declared_content_item_value) * self.declared_content_items_per_unit
        return round(self.quantity * unit_qty * (float(self.declared_unit_value) + content_val), 2)


class PickupLabel(Base):
    """Étiquette individuelle par unité / Individual label per unit."""
    __tablename__ = "pickup_labels"
    __table_args__ = (
        Index("ix_pickup_labels_request_id", "pickup_request_id"),
        Index("ix_pickup_labels_status", "status"),
        Index("ix_pickup_labels_tour_stop", "tour_stop_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pickup_request_id: Mapped[int] = mapped_column(ForeignKey("pickup_requests.id", ondelete="CASCADE"), nullable=False)
    label_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # RET-{PDV}-{SUPPORT}-{DATE}-{SEQ}
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-based
    status: Mapped[LabelStatus] = mapped_column(Enum(LabelStatus), nullable=False, default=LabelStatus.PENDING)
    tour_stop_id: Mapped[int | None] = mapped_column(ForeignKey("tour_stops.id"))
    picked_up_at: Mapped[str | None] = mapped_column(String(32))  # ISO 8601
    picked_up_device_id: Mapped[int | None] = mapped_column(ForeignKey("mobile_devices.id"))
    received_at: Mapped[str | None] = mapped_column(String(32))  # ISO 8601
    received_device_id: Mapped[int | None] = mapped_column(ForeignKey("mobile_devices.id"))

    # Relations
    pickup_request: Mapped["PickupRequest"] = relationship(back_populates="labels")
    movements: Mapped[list["PickupMovement"]] = relationship(back_populates="pickup_label", cascade="all, delete-orphan")


class PickupMovement(Base):
    """Mouvement contenant — traçabilité complète / Container movement — full traceability.
    Chaque changement de statut d'une étiquette crée un mouvement.
    Every label status change creates a movement record.
    """
    __tablename__ = "pickup_movements"
    __table_args__ = (
        Index("ix_pickup_movements_label_id", "pickup_label_id"),
        Index("ix_pickup_movements_timestamp", "timestamp"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pickup_label_id: Mapped[int] = mapped_column(ForeignKey("pickup_labels.id", ondelete="CASCADE"), nullable=False)
    movement_type: Mapped[MovementType] = mapped_column(Enum(MovementType), nullable=False)
    timestamp: Mapped[str] = mapped_column(String(32), nullable=False)  # ISO 8601
    device_id: Mapped[int | None] = mapped_column(ForeignKey("mobile_devices.id"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    # Relations
    pickup_label: Mapped["PickupLabel"] = relationship(back_populates="movements")
