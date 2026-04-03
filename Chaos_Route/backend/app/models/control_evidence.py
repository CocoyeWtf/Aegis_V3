"""Modele preuve de controle / Control evidence model.
Stocke les photos prises par le chauffeur lors d'un scan en mode controle.
Applicable aux reprises PDV, scans combis, reception base et inventaire.
"""

import enum

from sqlalchemy import Enum, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ControlContext(str, enum.Enum):
    """Contexte du controle / Control context."""
    PICKUP = "PICKUP"              # Reprise etiquette au PDV
    COMBI_SCAN = "COMBI_SCAN"      # Scan combi au PDV
    RECEPTION = "RECEPTION"        # Reception base
    INVENTORY = "INVENTORY"        # Inventaire


class ControlEvidence(Base):
    """Preuve photographique de controle / Photographic control evidence."""
    __tablename__ = "control_evidences"
    __table_args__ = (
        Index("ix_ctrl_evidence_device_date", "device_id", "scan_date"),
        Index("ix_ctrl_evidence_pdv_date", "pdv_id", "scan_date"),
        Index("ix_ctrl_evidence_context_date", "control_context", "scan_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    control_context: Mapped[ControlContext] = mapped_column(Enum(ControlContext), nullable=False)

    # Appareil / Device
    device_id: Mapped[int] = mapped_column(ForeignKey("mobile_devices.id"), nullable=False)

    # PDV (optionnel pour contexte RECEPTION/INVENTORY)
    pdv_id: Mapped[int | None] = mapped_column(ForeignKey("pdvs.id"), nullable=True)
    pdv_code_scanned: Mapped[str | None] = mapped_column(String(20))

    # Reference au scan (selon le contexte)
    label_code: Mapped[str | None] = mapped_column(String(50))     # RET-xxx pour PICKUP
    combi_barcode: Mapped[str | None] = mapped_column(String(50))  # RM###### pour COMBI_SCAN

    # GPS
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Photo
    photo_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    photo_path: Mapped[str] = mapped_column(String(500), nullable=False)
    photo_size: Mapped[int | None] = mapped_column(Integer)
    photo_mime: Mapped[str | None] = mapped_column(String(50))

    # Timestamps
    timestamp: Mapped[str] = mapped_column(String(32), nullable=False)    # ISO 8601, moment de la prise
    scan_date: Mapped[str] = mapped_column(String(10), nullable=False)    # YYYY-MM-DD
    uploaded_at: Mapped[str] = mapped_column(String(32), nullable=False)  # ISO 8601, reception serveur

    # Relations
    pdv: Mapped["PDV | None"] = relationship()
    device: Mapped["MobileDevice | None"] = relationship()
