"""Modele demande de casiers / Crate request model.
Les PDV commandent des casiers vides a la base logistique.
Le service vidange traite et livre les casiers.
"""

import enum

from sqlalchemy import Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CrateRequestStatus(str, enum.Enum):
    """Statut de la demande / Request status."""
    REQUESTED = "REQUESTED"    # PDV a fait la demande
    ORDERED = "ORDERED"        # Service vidange a commande au fournisseur
    DELIVERED = "DELIVERED"    # Casiers livres au PDV
    CANCELLED = "CANCELLED"   # Demande annulee


class CrateRequest(Base):
    """Demande de casiers vides par un PDV / Empty crate request by a PDV."""
    __tablename__ = "crate_requests"
    __table_args__ = (
        Index("ix_crate_requests_pdv_id", "pdv_id"),
        Index("ix_crate_requests_status", "status"),
        Index("ix_crate_requests_requested_at", "requested_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pdv_id: Mapped[int] = mapped_column(ForeignKey("pdvs.id"), nullable=False)
    crate_type_id: Mapped[int] = mapped_column(ForeignKey("crate_types.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # Nombre de casiers individuels
    status: Mapped[CrateRequestStatus] = mapped_column(
        Enum(CrateRequestStatus), default=CrateRequestStatus.REQUESTED, nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)

    # Timestamps
    requested_at: Mapped[str] = mapped_column(String(32), nullable=False)   # ISO 8601
    requested_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    ordered_at: Mapped[str | None] = mapped_column(String(32))              # ISO 8601
    ordered_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    delivered_at: Mapped[str | None] = mapped_column(String(32))            # ISO 8601
    delivered_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    # Relations
    pdv: Mapped["PDV"] = relationship()
    crate_type: Mapped["CrateType"] = relationship()
