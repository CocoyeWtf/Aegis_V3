"""Facture immobilisation GIC / GIC immobilization invoice model.
Facture quadrimestrielle des dépassements PUO par PDV × type de contenant.
Quarterly invoice for PUO overages per PDV × support type.
"""

import enum

from sqlalchemy import Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GicInvoiceStatus(str, enum.Enum):
    """Statut facture / Invoice status."""
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    SENT = "SENT"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class GicInvoice(Base):
    """Facture GIC (1 par période) / GIC invoice (1 per period)."""
    __tablename__ = "gic_invoices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Période quadrimestrielle / Quadrimester period
    period_label: Mapped[str] = mapped_column(String(20), nullable=False)  # ex: "2026-Q1" (Jan-Avr)
    period_start: Mapped[str] = mapped_column(String(10), nullable=False)  # ISO date
    period_end: Mapped[str] = mapped_column(String(10), nullable=False)    # ISO date
    # Totaux / Totals
    total_overage_units: Mapped[int] = mapped_column(Integer, default=0)
    total_overage_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    pdv_count: Mapped[int] = mapped_column(Integer, default=0)
    line_count: Mapped[int] = mapped_column(Integer, default=0)
    # Métadonnées / Metadata
    status: Mapped[str] = mapped_column(Enum(GicInvoiceStatus), default=GicInvoiceStatus.DRAFT)
    generated_at: Mapped[str] = mapped_column(String(30), nullable=False)  # ISO 8601
    generated_by: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    base_id: Mapped[int | None] = mapped_column(ForeignKey("base_logistics.id"))

    # Relations
    lines: Mapped[list["GicInvoiceLine"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    base: Mapped["BaseLogistics | None"] = relationship()

    def __repr__(self) -> str:
        return f"<GicInvoice {self.period_label} — {self.status}>"


class GicInvoiceLine(Base):
    """Ligne de facture GIC / GIC invoice line item."""
    __tablename__ = "gic_invoice_lines"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("gic_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    # PDV
    pdv_id: Mapped[int] = mapped_column(ForeignKey("pdvs.id"), nullable=False)
    pdv_code: Mapped[str] = mapped_column(String(20), nullable=False)
    pdv_name: Mapped[str] = mapped_column(String(150), nullable=False)
    # Type support
    support_type_id: Mapped[int] = mapped_column(ForeignKey("support_types.id"), nullable=False)
    support_type_code: Mapped[str] = mapped_column(String(20), nullable=False)
    support_type_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Valeurs snapshot / Snapshot values
    current_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    puo: Mapped[int] = mapped_column(Integer, nullable=False)
    overage: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_value: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    overage_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    # Relations
    invoice: Mapped["GicInvoice"] = relationship(back_populates="lines")

    def __repr__(self) -> str:
        return f"<GicInvoiceLine {self.pdv_code} {self.support_type_code} +{self.overage}>"
