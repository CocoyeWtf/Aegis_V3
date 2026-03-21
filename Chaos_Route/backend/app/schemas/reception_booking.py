"""Schemas booking reception V2 / Reception booking schemas V2."""

from pydantic import BaseModel, ConfigDict


# ─── DockConfig ───

class DockScheduleCreate(BaseModel):
    day_of_week: int       # 0=Lundi..6=Dimanche
    open_time: str         # HH:MM
    close_time: str        # HH:MM


class DockScheduleRead(DockScheduleCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    dock_config_id: int


class DockConfigCreate(BaseModel):
    base_id: int
    dock_type: str         # SEC, FRAIS, GEL, FFL
    dock_count: int
    pallets_per_hour: int = 30
    setup_minutes: int = 10
    departure_minutes: int = 8
    schedules: list[DockScheduleCreate] = []


class DockConfigUpdate(BaseModel):
    dock_count: int | None = None
    pallets_per_hour: int | None = None
    setup_minutes: int | None = None
    departure_minutes: int | None = None
    schedules: list[DockScheduleCreate] | None = None


class DockConfigRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    base_id: int
    dock_type: str
    dock_count: int
    pallets_per_hour: int
    setup_minutes: int
    departure_minutes: int
    schedules: list[DockScheduleRead] = []
    base_name: str | None = None


# ─── DockScheduleOverride ───

class DockScheduleOverrideCreate(BaseModel):
    dock_config_id: int
    override_date: str          # YYYY-MM-DD
    is_closed: bool = False
    open_time: str | None = None
    close_time: str | None = None
    dock_count: int | None = None
    notes: str | None = None


class DockScheduleOverrideUpdate(BaseModel):
    is_closed: bool | None = None
    open_time: str | None = None
    close_time: str | None = None
    dock_count: int | None = None
    notes: str | None = None


class DockScheduleOverrideRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    dock_config_id: int
    override_date: str
    is_closed: bool
    open_time: str | None = None
    close_time: str | None = None
    dock_count: int | None = None
    notes: str | None = None


class DayAvailabilitySummary(BaseModel):
    date: str
    dock_type: str
    is_closed: bool
    open_time: str | None = None
    close_time: str | None = None
    dock_count: int
    has_override: bool
    booking_count: int = 0
    pallet_total: int = 0


# ─── Booking ───

class BookingOrderCreate(BaseModel):
    order_number: str
    pallet_count: int | None = None
    cnuf: str | None = None
    filiale: str | None = None
    operation: str | None = None
    delivery_date_required: str | None = None
    delivery_time_requested: str | None = None
    supplier_name: str | None = None


class BookingOrderRead(BookingOrderCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    booking_id: int
    article_count: int | None = None
    reconciled: bool = False


class BookingCreate(BaseModel):
    base_id: int
    dock_type: str
    booking_date: str      # YYYY-MM-DD
    start_time: str        # HH:MM
    pallet_count: int
    dock_number: int | None = None
    supplier_name: str | None = None
    temperature_type: str | None = None
    is_locked: bool = False
    notes: str | None = None
    orders: list[BookingOrderCreate] = []


class BookingUpdate(BaseModel):
    dock_type: str | None = None
    dock_number: int | None = None
    booking_date: str | None = None
    start_time: str | None = None
    pallet_count: int | None = None
    status: str | None = None
    is_locked: bool | None = None
    supplier_name: str | None = None
    temperature_type: str | None = None
    notes: str | None = None


class BookingMoveSlot(BaseModel):
    """Deplacement drag & drop / Drag & drop move."""
    booking_date: str
    start_time: str
    dock_number: int | None = None


class BookingCheckinCreate(BaseModel):
    order_number: str
    license_plate: str
    phone_number: str
    driver_name: str | None = None


class BookingCheckinRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    booking_id: int
    license_plate: str
    phone_number: str
    driver_name: str | None = None
    checkin_time: str


class BookingDockEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    booking_id: int
    event_type: str
    dock_number: int | None = None
    timestamp: str
    user_id: int | None = None


class BookingRefusalCreate(BaseModel):
    reason: str
    notes: str | None = None


class BookingRefusalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    booking_id: int
    reason: str
    refused_by_user_id: int
    timestamp: str
    notes: str | None = None


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    base_id: int
    dock_type: str
    dock_number: int | None = None
    booking_date: str
    start_time: str
    end_time: str
    pallet_count: int
    estimated_duration_minutes: int
    status: str
    is_locked: bool
    supplier_name: str | None = None
    temperature_type: str | None = None
    notes: str | None = None
    created_by_user_id: int | None = None
    created_at: str | None = None
    orders: list[BookingOrderRead] = []
    checkin: BookingCheckinRead | None = None
    dock_events: list[BookingDockEventRead] = []
    refusal: BookingRefusalRead | None = None


# ─── Slot availability ───

class SlotAvailability(BaseModel):
    start_time: str
    end_time: str
    dock_type: str
    available_docks: list[int]
    total_docks: int


class SuggestedSlot(BaseModel):
    start_time: str
    end_time: str
    dock_number: int
    score: int          # 0-100, plus haut = meilleur
    reason: str         # Explication courte du score


# ─── OrderImport ───

class OrderImportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    import_batch_id: str
    base_code: str
    order_number: str
    cnuf: str | None = None
    filiale: str | None = None
    operation: str | None = None
    pallet_count: int
    delivery_date: str | None = None
    delivery_time: str | None = None
    supplier_name: str | None = None
    article_count: int
    import_date: str
    reconciled: bool
    booking_id: int | None = None


class OrderImportResult(BaseModel):
    imported: int
    reconciled: int
    errors: list[str]
    batch_id: str
