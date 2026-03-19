"""Schemas demande d'enlevement fournisseur / Supplier collection request schemas."""

from pydantic import BaseModel, ConfigDict


class CollectionRequestCreate(BaseModel):
    supplier_id: int
    base_id: int
    eqp_count: float
    pickup_date: str       # YYYY-MM-DD
    needed_by_date: str    # YYYY-MM-DD
    notes: str | None = None


class CollectionRequestUpdate(BaseModel):
    status: str | None = None
    eqp_count: float | None = None
    pickup_date: str | None = None
    needed_by_date: str | None = None
    notes: str | None = None
    tour_id: int | None = None
    transport_notes: str | None = None


class SupplierBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str


class BaseBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str


class CollectionRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    supplier_id: int
    base_id: int
    eqp_count: float
    pickup_date: str
    needed_by_date: str
    status: str
    tour_id: int | None = None
    transport_notes: str | None = None
    notes: str | None = None
    created_by_user_id: int | None = None
    created_at: str
    planned_at: str | None = None
    picked_up_at: str | None = None
    delivered_at: str | None = None
    # Relations enrichies
    supplier: SupplierBrief | None = None
    base: BaseBrief | None = None
    created_by_username: str | None = None
    tour_code: str | None = None
