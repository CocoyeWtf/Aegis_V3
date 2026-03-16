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
    image_path: str | None = None
    # Valeur consigne / Consignment value
    unit_value: float | None = None
    content_item_label: str | None = None
    content_items_per_unit: int | None = None
    content_item_value: float | None = None


class SupportTypeUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    unit_quantity: int | None = None
    unit_label: str | None = None
    is_active: bool | None = None
    image_path: str | None = None
    # Valeur consigne / Consignment value
    unit_value: float | None = None
    content_item_label: str | None = None
    content_items_per_unit: int | None = None
    content_item_value: float | None = None


class SupportTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    unit_quantity: int
    unit_label: str | None
    is_active: bool
    image_path: str | None = None
    # Valeur consigne / Consignment value
    unit_value: float | None = None
    content_item_label: str | None = None
    content_items_per_unit: int | None = None
    content_item_value: float | None = None


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
    received_device_id: int | None = None


# --- PickupRequest ---
class PickupRequestCreate(BaseModel):
    pdv_id: int
    support_type_id: int | None = None
    quantity: int
    availability_date: str  # YYYY-MM-DD
    pickup_type: str = "CONTAINER"
    notes: str | None = None
    # Consigne : contenu inclus (ex: bouteilles vides dans les bacs)
    # Consignment: content included (e.g., empty bottles in crates)
    with_content: bool = False


class PickupRequestUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    availability_date: str | None = None
    quantity: int | None = None
    with_content: bool | None = None


class PDVBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str


class PickupRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pdv_id: int
    support_type_id: int | None = None
    quantity: int
    availability_date: str
    pickup_type: str
    status: str
    requested_at: datetime | None
    requested_by_user_id: int | None
    notes: str | None
    # Consigne
    with_content: bool = False
    declared_unit_value: float | None = None
    declared_unit_quantity: int | None = None
    declared_content_item_value: float | None = None
    declared_content_items_per_unit: int | None = None
    total_declared_value: float | None = None
    # Relations
    pdv: PDVBrief | None = None
    support_type: SupportTypeRead | None = None
    labels: list[PickupLabelRead] = []


class PickupRequestListRead(BaseModel):
    """Version allégée avec compteurs labels / Lightweight version with label counts for lists."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    pdv_id: int
    support_type_id: int | None = None
    quantity: int
    availability_date: str
    pickup_type: str
    status: str
    requested_at: datetime | None
    requested_by_user_id: int | None
    notes: str | None
    # Consigne
    with_content: bool = False
    declared_unit_value: float | None = None
    declared_unit_quantity: int | None = None
    declared_content_item_value: float | None = None
    declared_content_items_per_unit: int | None = None
    total_declared_value: float | None = None
    # Compteurs labels / Label counters
    total_labels: int = 0
    pending_count: int = 0
    picked_up_count: int = 0
    received_count: int = 0
    # Relations
    pdv: PDVBrief | None = None
    support_type: SupportTypeRead | None = None


# --- Résumé par PDV pour planning ---
class PdvPickupSummary(BaseModel):
    pdv_id: int
    pdv_code: str
    pdv_name: str
    pending_count: int  # nombre total d'étiquettes en attente
    requests: list[PickupRequestListRead]
