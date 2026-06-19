"""Modele scan combi / Combi scan model.
Stocke les scans de combis (immatricules RM+6 chiffres) par le chauffeur au PDV
et la re-confirmation a la base.
"""

import enum

from sqlalchemy import Enum, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TenantMixin


class ScanContext(str, enum.Enum):
    """Contexte du scan / Scan context."""
    PICKUP = "PICKUP"        # Chauffeur au PDV / Driver at PDV
    RECEPTION = "RECEPTION"  # Re-scan base / Base re-scan


class CombiScan(Base, TenantMixin):
    """Scan individuel d'un combi / Individual combi scan."""
    __tablename__ = "combi_scans"
    __table_args__ = (
        Index("ix_combi_scans_barcode", "barcode"),
        Index("ix_combi_scans_pdv_date", "pdv_id", "scan_date"),
        Index("ix_combi_scans_device_date", "device_id", "scan_date"),
        Index("ix_combi_scans_context_date", "scan_context", "scan_date"),
        Index("ix_combi_scans_pickup_label_id", "pickup_label_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    barcode: Mapped[str] = mapped_column(String(50), nullable=False)  # ex: RM047521
    scan_context: Mapped[ScanContext] = mapped_column(Enum(ScanContext), nullable=False)
    pdv_id: Mapped[int | None] = mapped_column(ForeignKey("pdvs.id"), nullable=True)
    pdv_code_scanned: Mapped[str | None] = mapped_column(String(20))  # Code PDV brut scanne
    device_id: Mapped[int | None] = mapped_column(ForeignKey("mobile_devices.id"), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)  # Si scan backoffice
    timestamp: Mapped[str] = mapped_column(String(32), nullable=False)  # ISO 8601
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    scan_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD, pour requetes journalieres
    # Lien vers l'etiquette de declaration combi scannee par le chauffeur a son arrivee /
    # Link to combi declaration label scanned by driver on arrival
    pickup_label_id: Mapped[int | None] = mapped_column(
        ForeignKey("pickup_labels.id", ondelete="SET NULL"), nullable=True
    )

    # Relations
    pdv: Mapped["PDV | None"] = relationship()
    device: Mapped["MobileDevice | None"] = relationship()
    pickup_label: Mapped["PickupLabel | None"] = relationship(
        "PickupLabel", back_populates="combi_scans"
    )
