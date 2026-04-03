"""Schemas casiers / Crate schemas."""

from pydantic import BaseModel, ConfigDict


# ─── CrateType ───

class CrateTypeCreate(BaseModel):
    code: str
    name: str
    format: str        # 25CL, 33CL, 75CL, 1L, FUT6L, OTHER
    brand: str | None = None
    sorting_rule: str = "SPECIFIC"   # SPECIFIC, FORMAT_MIX
    is_active: bool = True

class CrateTypeUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    format: str | None = None
    brand: str | None = None
    sorting_rule: str | None = None
    is_active: bool | None = None

class CrateTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    format: str
    brand: str | None = None
    sorting_rule: str
    is_active: bool


# ─── CrateRequest ───

class CrateRequestCreate(BaseModel):
    pdv_id: int | None = None     # Forcer par le backend si utilisateur PDV
    crate_type_id: int
    quantity: int
    notes: str | None = None

class CrateRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pdv_id: int
    crate_type_id: int
    quantity: int
    status: str
    notes: str | None = None
    requested_at: str
    requested_by_user_id: int | None = None
    ordered_at: str | None = None
    ordered_by_user_id: int | None = None
    delivered_at: str | None = None
    delivered_by_user_id: int | None = None
    # Nested
    pdv: dict | None = None
    crate_type: CrateTypeRead | None = None

class CrateRequestStatusUpdate(BaseModel):
    status: str       # ORDERED, DELIVERED, CANCELLED
    notes: str | None = None
