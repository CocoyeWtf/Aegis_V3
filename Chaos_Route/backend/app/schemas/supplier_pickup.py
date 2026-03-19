"""Schemas demande reprise fournisseur / Supplier pickup request schemas."""

from pydantic import BaseModel, ConfigDict


class SupplierPickupLineCreate(BaseModel):
    support_type_id: int
    palette_count: int
    unit_count: int | None = None
    notes: str | None = None


class SupplierPickupLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    request_id: int
    support_type_id: int
    palette_count: int
    unit_count: int | None = None
    notes: str | None = None
    # Enrichi cote API / Enriched on API side
    support_type_name: str | None = None
    support_type_code: str | None = None


class SupplierPickupRequestCreate(BaseModel):
    base_id: int
    supplier_id: int
    notes: str | None = None
    lines: list[SupplierPickupLineCreate]


class SupplierPickupRequestUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    lines: list[SupplierPickupLineCreate] | None = None


class SupplierBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    email: str | None = None


class BaseBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str | None = None
    name: str


class SupplierPickupRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    base_id: int
    supplier_id: int
    status: str
    notes: str | None = None
    created_by_user_id: int | None = None
    created_at: str
    sent_at: str | None = None
    confirmed_at: str | None = None
    picked_up_at: str | None = None
    # Relations enrichies
    supplier: SupplierBrief | None = None
    base: BaseBrief | None = None
    lines: list[SupplierPickupLineRead] = []
    created_by_username: str | None = None


class StockAlertRead(BaseModel):
    """Alerte stock base depasse le seuil / Base stock alert above threshold."""
    base_id: int
    base_name: str
    support_type_id: int
    support_type_name: str
    support_type_code: str
    current_stock: int
    alert_threshold: int
    supplier_id: int | None = None
    supplier_name: str | None = None
