"""Modele Historique d'impression d'etiquettes / Label print event model.

Trace chaque impression d'etiquette (qui, quand, par quel moyen, succes/echec).
Distinct du print_count sur PickupRequest qui n'est qu'un compteur global :
ici on a l'historique detaille pour audit et debug.

Traces every label print (who, when, by which means, success/failure).
Distinct from PickupRequest.print_count which is just a global counter:
here we have detailed history for audit and debug.
"""

import enum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TenantMixin


class PrintProtocol(str, enum.Enum):
    """Protocole d'impression / Print protocol."""
    ZPL = "ZPL"       # Zebra
    TSPL = "TSPL"     # TSC
    HTML = "HTML"     # Frontend web (a4/avery/etc)


class PrintSource(str, enum.Enum):
    """Source de l'impression / Print source."""
    MOBILE_PDV = "MOBILE_PDV"     # PDV mobile, imprimante Bluetooth portable
    WEB_PRINT = "WEB_PRINT"        # Frontend web (PickupLabelPrint)
    OFFICE_BULK = "OFFICE_BULK"    # Reimpression admin/dispatcher


class LabelPrintEvent(Base, TenantMixin):
    """Evenement d'impression d'une etiquette / Label print event."""
    __tablename__ = "pickup_label_print_events"
    __table_args__ = (
        Index("ix_label_print_events_label_id", "pickup_label_id"),
        Index("ix_label_print_events_printed_at", "printed_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pickup_label_id: Mapped[int] = mapped_column(
        ForeignKey("pickup_labels.id", ondelete="CASCADE"), nullable=False
    )
    protocol: Mapped[PrintProtocol] = mapped_column(Enum(PrintProtocol), nullable=False)
    source: Mapped[PrintSource] = mapped_column(Enum(PrintSource), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    device_id: Mapped[int | None] = mapped_column(
        ForeignKey("mobile_devices.id"), nullable=True
    )
    printed_at: Mapped[str] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    printer_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Adresse Bluetooth ou IP imprimante / Printer Bluetooth address or IP
    printer_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    success: Mapped[bool] = mapped_column(default=True, nullable=False)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relations
    pickup_label: Mapped["PickupLabel"] = relationship()
