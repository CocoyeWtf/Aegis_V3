"""Modèle Archive CMR / CMR Waybill Archive model.

Stocke un snapshot immutable de la lettre de voiture CMR conforme à la Convention de Genève 1956.
Stores an immutable snapshot of the CMR waybill compliant with the Geneva Convention 1956.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CMRStatus(str, enum.Enum):
    """Statut du CMR / CMR status."""
    DRAFT = "DRAFT"          # Brouillon, modifiable / Draft, editable
    ISSUED = "ISSUED"        # Émis, snapshot figé / Issued, snapshot frozen
    DELIVERED = "DELIVERED"  # Livré, signé destinataire / Delivered, recipient signed
    CANCELLED = "CANCELLED"  # Annulé / Cancelled


class WaybillArchive(Base):
    """Archive CMR — lettre de voiture immutable / CMR waybill archive — immutable consignment note."""
    __tablename__ = "waybill_archives"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Numéro CMR unique (format CMR-YYYY-NNNNNN) / Unique CMR number
    cmr_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    # Lien tour (1 CMR par tour) / Tour link (1 CMR per tour)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), unique=True, nullable=False)
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)

    # Statut / Status
    status: Mapped[CMRStatus] = mapped_column(Enum(CMRStatus), default=CMRStatus.DRAFT, nullable=False)

    # Snapshot JSON — données complètes figées à l'émission / Full data frozen at issuance
    snapshot_json: Mapped[str | None] = mapped_column(Text)

    # Case 21 — Établi à ... le ... / Established at ... on ...
    establishment_place: Mapped[str | None] = mapped_column(String(100))
    establishment_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD

    # Émission / Issuance
    issued_at: Mapped[str | None] = mapped_column(String(32))  # ISO 8601
    issued_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    # Case 5 — Documents annexés / Attached documents
    attached_documents: Mapped[str | None] = mapped_column(Text)

    # Case 13 — Instructions de l'expéditeur / Sender's instructions
    sender_instructions: Mapped[str | None] = mapped_column(Text)

    # Case 14 — Prescriptions d'affranchissement / Payment instructions
    payment_instructions: Mapped[str | None] = mapped_column(String(200))

    # Case 15 — Remboursement / Cash on delivery
    cash_on_delivery: Mapped[str | None] = mapped_column(String(100))

    # Case 18 — Réserves et observations du transporteur / Carrier's reservations
    reservations: Mapped[str | None] = mapped_column(Text)

    # Case 19 — Conventions particulières / Special agreements
    special_agreements: Mapped[str | None] = mapped_column(Text)

    # Signatures — ISO 8601 datetime quand chaque partie a signé
    sender_signed_at: Mapped[str | None] = mapped_column(String(32))
    carrier_signed_at: Mapped[str | None] = mapped_column(String(32))
    recipient_signed_at: Mapped[str | None] = mapped_column(String(32))

    # Réception / Delivery
    recipient_name: Mapped[str | None] = mapped_column(String(150))
    delivery_remarks: Mapped[str | None] = mapped_column(Text)

    # Timestamps
    created_at: Mapped[str] = mapped_column(
        String(32), default=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Mapped[str] = mapped_column(
        String(32), default=lambda: datetime.now(timezone.utc).isoformat(),
        onupdate=lambda: datetime.now(timezone.utc).isoformat()
    )

    # Relations
    tour: Mapped["Tour"] = relationship(foreign_keys=[tour_id])
    region: Mapped["Region"] = relationship(foreign_keys=[region_id])
    issued_by: Mapped["User | None"] = relationship(foreign_keys=[issued_by_id])

    def __repr__(self) -> str:
        return f"<WaybillArchive {self.cmr_number} — tour={self.tour_id} status={self.status}>"
