"""Schemas booking reception / Reception booking schemas."""

from pydantic import BaseModel, ConfigDict


# ─── Config ───

class ReceptionConfigCreate(BaseModel):
    base_id: int
    opening_time: str = "06:00"
    closing_time: str = "14:00"
    dock_count: int = 2
    slot_duration_minutes: int = 30
    productivity_eqp_per_slot: float = 2.0


class ReceptionConfigRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    base_id: int
    opening_time: str
    closing_time: str
    dock_count: int
    slot_duration_minutes: int
    productivity_eqp_per_slot: float
    base_name: str | None = None


# ─── Purchase Orders ───

class PurchaseOrderCreate(BaseModel):
    base_id: int
    supplier_id: int
    order_ref: str
    eqp_count: float
    expected_delivery_date: str  # YYYY-MM-DD
    notes: str | None = None


class PurchaseOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    base_id: int
    supplier_id: int
    order_ref: str
    eqp_count: float
    expected_delivery_date: str
    status: str
    notes: str | None = None
    created_at: str
    supplier_name: str | None = None
    base_name: str | None = None


# ─── Bookings ───

class BookingCreate(BaseModel):
    purchase_order_id: int
    base_id: int
    booking_date: str     # YYYY-MM-DD
    start_time: str       # HH:MM
    dock_number: int
    notes: str | None = None


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    purchase_order_id: int
    base_id: int
    supplier_id: int
    booking_date: str
    start_time: str
    end_time: str
    dock_number: int
    slots_needed: int
    status: str
    created_at: str
    arrived_at: str | None = None
    completed_at: str | None = None
    notes: str | None = None
    # Enrichi
    supplier_name: str | None = None
    base_name: str | None = None
    order_ref: str | None = None
    eqp_count: float | None = None


class BookingUpdate(BaseModel):
    status: str | None = None
    booking_date: str | None = None
    start_time: str | None = None
    dock_number: int | None = None
    notes: str | None = None


# ─── Disponibilite creneaux ───

class SlotAvailability(BaseModel):
    """Creneau disponible / Available slot."""
    start_time: str   # HH:MM
    end_time: str     # HH:MM
    available_docks: list[int]  # Numeros de quais disponibles
