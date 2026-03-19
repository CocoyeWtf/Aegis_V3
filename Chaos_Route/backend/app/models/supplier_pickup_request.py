"""Demande de reprise fournisseur / Supplier pickup request model.
Gere les demandes de recuperation de contenants base vers fournisseur.
Manages container return requests from base to supplier.
"""

import enum

from sqlalchemy import Column, Enum, ForeignKey, Index, Integer, String, Text
from app.database import Base


class SupplierPickupStatus(str, enum.Enum):
    """Statut de la demande / Request status."""
    DRAFT = "DRAFT"            # Brouillon / Draft
    SENT = "SENT"              # Envoyee par email / Sent by email
    CONFIRMED = "CONFIRMED"    # Confirmee par le fournisseur / Confirmed by supplier
    PICKED_UP = "PICKED_UP"    # Enlevee / Picked up by supplier


class SupplierPickupRequest(Base):
    """Demande de reprise fournisseur (base -> fournisseur).
    Supplier pickup request (base -> supplier)."""
    __tablename__ = "supplier_pickup_requests"
    __table_args__ = (
        Index("ix_spr_supplier", "supplier_id"),
        Index("ix_spr_base", "base_id"),
        Index("ix_spr_status", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    base_id = Column(Integer, ForeignKey("bases_logistics.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    status = Column(Enum(SupplierPickupStatus), nullable=False, default=SupplierPickupStatus.DRAFT)
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Dates ISO 8601
    created_at = Column(String(32), nullable=False)
    sent_at = Column(String(32), nullable=True)
    confirmed_at = Column(String(32), nullable=True)
    picked_up_at = Column(String(32), nullable=True)


class SupplierPickupLine(Base):
    """Ligne de demande reprise fournisseur / Supplier pickup request line."""
    __tablename__ = "supplier_pickup_lines"
    __table_args__ = (
        Index("ix_spl_request", "request_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("supplier_pickup_requests.id", ondelete="CASCADE"), nullable=False)
    support_type_id = Column(Integer, ForeignKey("support_types.id"), nullable=False)
    palette_count = Column(Integer, nullable=False)  # Nombre de palettes
    unit_count = Column(Integer, nullable=True)       # Nombre d'unites (casiers)
    notes = Column(Text, nullable=True)
