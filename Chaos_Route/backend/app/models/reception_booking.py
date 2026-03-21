"""Booking reception fournisseur V2 / Supplier reception booking model V2.
Config quais par type (SEC/FRAIS/GEL/FFL), horaires par jour, reservations,
check-in borne, evenements quai, refus, import commandes.
"""

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DockType(str, enum.Enum):
    """Type de quai / Dock type."""
    SEC = "SEC"
    FRAIS = "FRAIS"
    GEL = "GEL"
    FFL = "FFL"


class BookingStatus(str, enum.Enum):
    """Statut reservation / Booking status."""
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"      # Chauffeur arrive sur site (borne/garde)
    AT_DOCK = "AT_DOCK"            # Chauffeur a quai (reception)
    UNLOADING = "UNLOADING"        # En cours de dechargement (reception)
    DOCK_LEFT = "DOCK_LEFT"        # Parti du quai (reception)
    COMPLETED = "COMPLETED"        # Parti du site (garde)
    CANCELLED = "CANCELLED"
    REFUSED = "REFUSED"
    NO_SHOW = "NO_SHOW"


class DockEventType(str, enum.Enum):
    """Type d'evenement quai / Dock event type."""
    ASSIGNED = "ASSIGNED"
    AT_DOCK = "AT_DOCK"
    UNLOADING = "UNLOADING"
    DOCK_LEFT = "DOCK_LEFT"
    SITE_LEFT = "SITE_LEFT"
    DEPARTED = "DEPARTED"          # Legacy — kept for existing data


class PurchaseOrderStatus(str, enum.Enum):
    """Statut commande / Purchase order status."""
    PENDING = "PENDING"
    BOOKED = "BOOKED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


# ─── DockConfig — Configuration quais par base x type ───

class DockConfig(Base):
    """Configuration des quais par base et type / Dock config per base and type."""
    __tablename__ = "dock_configs"
    __table_args__ = (
        Index("ix_dockconfig_base_type", "base_id", "dock_type", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    base_id: Mapped[int] = mapped_column(ForeignKey("bases_logistics.id"), nullable=False)
    dock_type: Mapped[DockType] = mapped_column(Enum(DockType), nullable=False)
    dock_count: Mapped[int] = mapped_column(Integer, nullable=False)
    pallets_per_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    setup_minutes: Mapped[int] = mapped_column(Integer, default=10)
    departure_minutes: Mapped[int] = mapped_column(Integer, default=8)

    # Relations
    base: Mapped["BaseLogistics"] = relationship()
    schedules: Mapped[list["DockSchedule"]] = relationship(
        back_populates="dock_config", cascade="all, delete-orphan"
    )
    overrides: Mapped[list["DockScheduleOverride"]] = relationship(
        back_populates="dock_config", cascade="all, delete-orphan"
    )


# ─── DockSchedule — Horaires ouverture par jour ───

class DockSchedule(Base):
    """Horaires ouverture quai par jour / Dock opening hours per weekday."""
    __tablename__ = "dock_schedules"
    __table_args__ = (
        Index("ix_dockschedule_config_day", "dock_config_id", "day_of_week", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    dock_config_id: Mapped[int] = mapped_column(ForeignKey("dock_configs.id", ondelete="CASCADE"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Lundi..6=Dimanche
    open_time: Mapped[str] = mapped_column(String(5), nullable=False)
    close_time: Mapped[str] = mapped_column(String(5), nullable=False)

    dock_config: Mapped["DockConfig"] = relationship(back_populates="schedules")


# ─── DockScheduleOverride — Exception calendrier pour une date specifique ───

class DockScheduleOverride(Base):
    """Exception horaire pour une date specifique / Schedule override for a specific date."""
    __tablename__ = "dock_schedule_overrides"
    __table_args__ = (
        Index("ix_dockoverride_config_date", "dock_config_id", "override_date", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    dock_config_id: Mapped[int] = mapped_column(ForeignKey("dock_configs.id", ondelete="CASCADE"), nullable=False)
    override_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    open_time: Mapped[str | None] = mapped_column(String(5))
    close_time: Mapped[str | None] = mapped_column(String(5))
    dock_count: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    dock_config: Mapped["DockConfig"] = relationship(back_populates="overrides")


# ─── Booking — Reservation creneau ───

class Booking(Base):
    """Reservation d'un creneau quai / Dock slot booking."""
    __tablename__ = "bookings"
    __table_args__ = (
        Index("ix_booking_base_date_v2", "base_id", "booking_date"),
        Index("ix_booking_status_v2", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    base_id: Mapped[int] = mapped_column(ForeignKey("bases_logistics.id"), nullable=False)
    dock_type: Mapped[DockType] = mapped_column(Enum(DockType), nullable=False)
    dock_number: Mapped[int | None] = mapped_column(Integer)
    booking_date: Mapped[str] = mapped_column(String(10), nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    pallet_count: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.DRAFT)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    supplier_name: Mapped[str | None] = mapped_column(String(200))
    temperature_type: Mapped[str | None] = mapped_column(String(10))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[str | None] = mapped_column(String(32))

    # Relations
    base: Mapped["BaseLogistics"] = relationship()
    created_by: Mapped["User | None"] = relationship()
    orders: Mapped[list["BookingOrder"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan"
    )
    checkin: Mapped["BookingCheckin | None"] = relationship(
        back_populates="booking", uselist=False, cascade="all, delete-orphan"
    )
    dock_events: Mapped[list["BookingDockEvent"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan"
    )
    refusal: Mapped["BookingRefusal | None"] = relationship(
        back_populates="booking", uselist=False, cascade="all, delete-orphan"
    )


# ─── BookingOrder — Commandes liees a un booking (groupage possible) ───

class BookingOrder(Base):
    """Commande liee a un booking / Order linked to a booking."""
    __tablename__ = "booking_orders"
    __table_args__ = (
        Index("ix_bookingorder_rd", "order_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    order_number: Mapped[str] = mapped_column(String(20), nullable=False)
    cnuf: Mapped[str | None] = mapped_column(String(20))
    filiale: Mapped[str | None] = mapped_column(String(10))
    operation: Mapped[str | None] = mapped_column(String(10))
    pallet_count: Mapped[int | None] = mapped_column(Integer)
    delivery_date_required: Mapped[str | None] = mapped_column(String(10))
    delivery_time_requested: Mapped[str | None] = mapped_column(String(5))
    supplier_name: Mapped[str | None] = mapped_column(String(200))
    article_count: Mapped[int | None] = mapped_column(Integer)
    reconciled: Mapped[bool] = mapped_column(Boolean, default=False)

    booking: Mapped["Booking"] = relationship(back_populates="orders")


# ─── BookingCheckin — Check-in borne chauffeur ───

class BookingCheckin(Base):
    """Check-in chauffeur a la borne / Driver check-in at kiosk."""
    __tablename__ = "booking_checkins"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, unique=True)
    license_plate: Mapped[str] = mapped_column(String(20), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    driver_name: Mapped[str | None] = mapped_column(String(100))
    checkin_time: Mapped[str] = mapped_column(String(32), nullable=False)

    booking: Mapped["Booking"] = relationship(back_populates="checkin")


# ─── BookingDockEvent — Evenements quai ───

class BookingDockEvent(Base):
    """Evenement quai reception / Dock event for reception team."""
    __tablename__ = "booking_dock_events"
    __table_args__ = (
        Index("ix_dockevt_booking_v2", "booking_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[DockEventType] = mapped_column(Enum(DockEventType), nullable=False)
    dock_number: Mapped[int | None] = mapped_column(Integer)
    timestamp: Mapped[str] = mapped_column(String(32), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    booking: Mapped["Booking"] = relationship(back_populates="dock_events")
    user: Mapped["User | None"] = relationship()


# ─── BookingRefusal — Refus avec motif obligatoire ───

class BookingRefusal(Base):
    """Refus d'un booking par la reception / Booking refusal by reception."""
    __tablename__ = "booking_refusals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, unique=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    refused_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    timestamp: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    booking: Mapped["Booking"] = relationship(back_populates="refusal")
    refused_by: Mapped["User"] = relationship()


# ─── OrderImport — Import quotidien commandes pour reconciliation ───

class OrderImport(Base):
    """Import quotidien commandes / Daily order import for reconciliation."""
    __tablename__ = "order_imports"
    __table_args__ = (
        Index("ix_orderimport_rd", "order_number"),
        Index("ix_orderimport_batch", "import_batch_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    import_batch_id: Mapped[str] = mapped_column(String(36), nullable=False)
    base_code: Mapped[str] = mapped_column(String(10), nullable=False)
    order_number: Mapped[str] = mapped_column(String(20), nullable=False)
    cnuf: Mapped[str | None] = mapped_column(String(20))
    filiale: Mapped[str | None] = mapped_column(String(10))
    operation: Mapped[str | None] = mapped_column(String(10))
    pallet_count: Mapped[int] = mapped_column(Integer, nullable=False)
    delivery_date: Mapped[str | None] = mapped_column(String(10))
    delivery_time: Mapped[str | None] = mapped_column(String(5))
    supplier_name: Mapped[str | None] = mapped_column(String(200))
    article_count: Mapped[int] = mapped_column(Integer, default=0)
    import_date: Mapped[str] = mapped_column(String(10), nullable=False)
    reconciled: Mapped[bool] = mapped_column(Boolean, default=False)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"))


# ── Legacy tables kept for backward compat (V1 — ne plus utiliser) ──
# ReceptionConfig, PurchaseOrder, ReceptionBooking tables still exist in DB
# but are no longer referenced by new code.
class ReceptionConfig(Base):
    __tablename__ = "reception_configs"
    id = mapped_column(Integer, primary_key=True)
    base_id = mapped_column(Integer)
    opening_time = mapped_column(String(5), default="06:00")
    closing_time = mapped_column(String(5), default="14:00")
    dock_count = mapped_column(Integer, default=2)
    slot_duration_minutes = mapped_column(Integer, default=30)
    productivity_eqp_per_slot = mapped_column(Numeric(5, 1), default=2.0)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = mapped_column(Integer, primary_key=True)
    base_id = mapped_column(Integer)
    supplier_id = mapped_column(Integer)
    order_ref = mapped_column(String(50))
    eqp_count = mapped_column(Numeric(10, 2))
    expected_delivery_date = mapped_column(String(10))
    status = mapped_column(String(20))
    notes = mapped_column(Text)
    created_at = mapped_column(String(32))


class ReceptionBooking(Base):
    __tablename__ = "reception_bookings"
    id = mapped_column(Integer, primary_key=True)
    purchase_order_id = mapped_column(Integer)
    base_id = mapped_column(Integer)
    supplier_id = mapped_column(Integer)
    booking_date = mapped_column(String(10))
    start_time = mapped_column(String(5))
    end_time = mapped_column(String(5))
    dock_number = mapped_column(Integer)
    slots_needed = mapped_column(Integer, default=1)
    status = mapped_column(String(20))
    created_at = mapped_column(String(32))
    arrived_at = mapped_column(String(32))
    completed_at = mapped_column(String(32))
    notes = mapped_column(Text)
