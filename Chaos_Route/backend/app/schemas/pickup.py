"""Schémas Pickup / Pickup schemas (SupportType, PickupRequest, PickupLabel)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


# --- SupportType ---
class SupportTypeCreate(BaseModel):
    code: str
    name: str
    unit_quantity: int = 1
    unit_label: str | None = None
    is_active: bool = True


class SupportTypeUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    unit_quantity: int | None = None
    unit_label: str | None = None
    is_active: bool | None = None


class SupportTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    unit_quantity: int
    unit_label: str | None
    is_active: bool


# --- PickupLabel ---
class PickupLabelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pickup_request_id: int
    label_code: str
    sequence_number: int
    status: str
    tour_stop_id: int | None
    picked_up_at: str | None
    picked_up_device_id: int | None
    received_at: str | None


# --- PickupRequest ---
class PickupRequestCreate(BaseModel):
    pdv_id: int
    support_type_id: int
    quantity: int
    availability_date: str  # YYYY-MM-DD
    pickup_type: str = "CONTAINER"
    notes: str | None = None


class PickupRequestUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    availability_date: str | None = None
    quantity: int | None = None


class PDVBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str


class PickupRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pdv_id: int
    support_type_id: int
    quantity: int
    availability_date: str
    pickup_type: str
    status: str
    requested_at: datetime | None
    requested_by_user_id: int | None
    notes: str | None
    pdv: PDVBrief | None = None
    support_type: SupportTypeRead | None = None
    labels: list[PickupLabelRead] = []


class PickupRequestListRead(BaseModel):
    """Version allégée sans labels pour les listes / Lightweight version without labels for lists."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    pdv_id: int
    support_type_id: int
    quantity: int
    availability_date: str
    pickup_type: str
    status: str
    requested_at: datetime | None
    requested_by_user_id: int | None
    notes: str | None
    pdv: PDVBrief | None = None
    support_type: SupportTypeRead | None = None


# --- Résumé par PDV pour planning ---
class PdvPickupSummary(BaseModel):
    pdv_id: int
    pdv_code: str
    pdv_name: str
    pending_count: int  # nombre total d'étiquettes en attente
    requests: list[PickupRequestListRead]
