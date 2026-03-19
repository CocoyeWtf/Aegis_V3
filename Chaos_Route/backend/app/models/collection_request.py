"""Demande d'enlevement fournisseur / Supplier collection request model.
Les acheteurs declarent un besoin d'enlevement chez un fournisseur,
le transport planifie (retour tournee ou dedie).
"""

import enum

from sqlalchemy import Column, Enum, Float, ForeignKey, Index, Integer, String, Text
from app.database import Base


class CollectionStatus(str, enum.Enum):
    """Statut de la demande d'enlevement / Collection request status."""
    REQUESTED = "REQUESTED"    # Demande par l'appro / Requested by procurement
    PLANNED = "PLANNED"        # Planifie par le transport / Planned by transport
    PICKED_UP = "PICKED_UP"    # Enleve chez le fournisseur / Picked up at supplier
    DELIVERED = "DELIVERED"    # Livre sur base / Delivered to base
    CANCELLED = "CANCELLED"    # Annule / Cancelled


class CollectionRequest(Base):
    """Demande d'enlevement fournisseur (appro -> transport).
    Supplier collection request (procurement -> transport)."""
    __tablename__ = "collection_requests"
    __table_args__ = (
        Index("ix_colreq_supplier", "supplier_id"),
        Index("ix_colreq_base", "base_id"),
        Index("ix_colreq_status", "status"),
        Index("ix_colreq_needed_by", "needed_by_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    base_id = Column(Integer, ForeignKey("bases_logistics.id"), nullable=False)
    # Volume
    eqp_count = Column(Float, nullable=False)  # Nombre d'equivalents palette
    # Dates
    pickup_date = Column(String(10), nullable=False)       # Date d'enlevement possible (YYYY-MM-DD)
    needed_by_date = Column(String(10), nullable=False)    # Besoin sur base au plus tard (YYYY-MM-DD)
    # Statut et planification
    status = Column(Enum(CollectionStatus), nullable=False, default=CollectionStatus.REQUESTED)
    tour_id = Column(Integer, ForeignKey("tours.id"), nullable=True)  # Tournee affectee (retour ou dedie)
    transport_notes = Column(Text, nullable=True)  # Notes du transport
    # Meta
    notes = Column(Text, nullable=True)  # Notes de l'appro
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(String(32), nullable=False)  # ISO 8601
    planned_at = Column(String(32), nullable=True)
    picked_up_at = Column(String(32), nullable=True)
    delivered_at = Column(String(32), nullable=True)
