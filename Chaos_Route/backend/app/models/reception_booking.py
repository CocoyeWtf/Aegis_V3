"""Booking reception fournisseur / Supplier reception booking model.
Configuration quais, commandes, reservations de creneaux.
"""

import enum

from sqlalchemy import Column, Enum, Float, ForeignKey, Index, Integer, String, Text
from app.database import Base


# ─── Configuration reception par base ───

class ReceptionConfig(Base):
    """Configuration reception d'une base / Base reception configuration."""
    __tablename__ = "reception_configs"

    id = Column(Integer, primary_key=True, index=True)
    base_id = Column(Integer, ForeignKey("bases_logistics.id"), nullable=False, unique=True)
    opening_time = Column(String(5), nullable=False, default="06:00")    # HH:MM
    closing_time = Column(String(5), nullable=False, default="14:00")    # HH:MM
    dock_count = Column(Integer, nullable=False, default=2)
    slot_duration_minutes = Column(Integer, nullable=False, default=30)
    productivity_eqp_per_slot = Column(Float, nullable=False, default=2.0)  # EQP dechargeable par creneau


# ─── Commandes fournisseur (injectees) ───

class PurchaseOrderStatus(str, enum.Enum):
    """Statut commande / Purchase order status."""
    PENDING = "PENDING"        # En attente de booking
    BOOKED = "BOOKED"          # Creneau reserve
    RECEIVED = "RECEIVED"      # Recu
    CANCELLED = "CANCELLED"    # Annule


class PurchaseOrder(Base):
    """Commande d'achat injectee / Injected purchase order."""
    __tablename__ = "purchase_orders"
    __table_args__ = (
        Index("ix_po_supplier", "supplier_id"),
        Index("ix_po_base", "base_id"),
        Index("ix_po_status", "status"),
        Index("ix_po_delivery_date", "expected_delivery_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    base_id = Column(Integer, ForeignKey("bases_logistics.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    order_ref = Column(String(50), nullable=False)           # Reference commande fournisseur
    eqp_count = Column(Float, nullable=False)                 # Nombre d'equivalents palette
    expected_delivery_date = Column(String(10), nullable=False)  # Date livraison prevue (YYYY-MM-DD)
    status = Column(Enum(PurchaseOrderStatus), nullable=False, default=PurchaseOrderStatus.PENDING)
    notes = Column(Text, nullable=True)
    created_at = Column(String(32), nullable=False)  # ISO 8601


# ─── Reservations creneaux ───

class BookingStatus(str, enum.Enum):
    """Statut reservation / Booking status."""
    BOOKED = "BOOKED"          # Reserve
    ARRIVED = "ARRIVED"        # Arrive a la base
    UNLOADING = "UNLOADING"    # En dechargement
    COMPLETED = "COMPLETED"    # Termine
    CANCELLED = "CANCELLED"    # Annule
    NO_SHOW = "NO_SHOW"        # Non presente


class ReceptionBooking(Base):
    """Reservation de creneau reception / Reception slot booking."""
    __tablename__ = "reception_bookings"
    __table_args__ = (
        Index("ix_booking_base_date", "base_id", "booking_date"),
        Index("ix_booking_supplier", "supplier_id"),
        Index("ix_booking_status", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    base_id = Column(Integer, ForeignKey("bases_logistics.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    # Creneau
    booking_date = Column(String(10), nullable=False)   # YYYY-MM-DD
    start_time = Column(String(5), nullable=False)       # HH:MM
    end_time = Column(String(5), nullable=False)         # HH:MM
    dock_number = Column(Integer, nullable=False)
    slots_needed = Column(Integer, nullable=False, default=1)  # Nombre de creneaux consecutifs
    # Statut et dates
    status = Column(Enum(BookingStatus), nullable=False, default=BookingStatus.BOOKED)
    created_at = Column(String(32), nullable=False)
    arrived_at = Column(String(32), nullable=True)
    completed_at = Column(String(32), nullable=True)
    notes = Column(Text, nullable=True)
