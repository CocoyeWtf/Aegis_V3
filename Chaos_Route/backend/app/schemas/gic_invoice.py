"""Schémas facture GIC / GIC invoice schemas."""

from pydantic import BaseModel, ConfigDict


class GicInvoiceLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pdv_id: int
    pdv_code: str
    pdv_name: str
    support_type_id: int
    support_type_code: str
    support_type_name: str
    current_stock: int
    puo: int
    overage: int
    unit_value: float
    overage_value: float


class GicInvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    period_label: str
    period_start: str
    period_end: str
    total_overage_units: int
    total_overage_value: float
    pdv_count: int
    line_count: int
    status: str
    generated_at: str
    generated_by: str | None = None
    notes: str | None = None
    base_id: int | None = None


class GicInvoiceDetail(GicInvoiceRead):
    lines: list[GicInvoiceLineRead] = []


class GicInvoiceGenerate(BaseModel):
    """Demande de génération de facture / Invoice generation request."""
    period_label: str  # ex: "2026-Q1"
    period_start: str  # ISO date
    period_end: str    # ISO date
    notes: str | None = None
    base_id: int | None = None


class GicInvoiceStatusUpdate(BaseModel):
    status: str  # DRAFT, CONFIRMED, SENT, PAID, CANCELLED
