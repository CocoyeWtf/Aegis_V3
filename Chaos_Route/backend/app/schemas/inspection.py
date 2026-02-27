"""Schemas inspection vehicule / Vehicle inspection schemas."""

from pydantic import BaseModel


# --- Templates ---

class InspectionTemplateCreate(BaseModel):
    label: str
    description: str | None = None
    category: str
    applicable_vehicle_types: str | None = None
    is_critical: bool = False
    requires_photo: bool = False
    display_order: int = 0
    is_active: bool = True


class InspectionTemplateUpdate(BaseModel):
    label: str | None = None
    description: str | None = None
    category: str | None = None
    applicable_vehicle_types: str | None = None
    is_critical: bool | None = None
    requires_photo: bool | None = None
    display_order: int | None = None
    is_active: bool | None = None


class InspectionTemplateRead(BaseModel):
    id: int
    label: str
    description: str | None = None
    category: str
    applicable_vehicle_types: str | None = None
    is_critical: bool
    requires_photo: bool
    display_order: int
    is_active: bool

    model_config = {"from_attributes": True}


# --- Inspection (mobile) ---

class InspectionStartRequest(BaseModel):
    """Demarre une inspection depuis le mobile / Start inspection from mobile."""
    vehicle_id: int
    tour_id: int | None = None
    inspection_type: str  # PRE_DEPARTURE, POST_RETURN, PERIODIC
    driver_name: str | None = None
    km_at_inspection: int | None = None
    latitude: float | None = None
    longitude: float | None = None


class InspectionItemSubmit(BaseModel):
    """Resultat d'un item / Item result."""
    item_id: int
    result: str  # OK, KO, NA
    comment: str | None = None


class InspectionItemsSubmit(BaseModel):
    """Soumission batch des items / Batch item results."""
    items: list[InspectionItemSubmit]


class InspectionCompleteRequest(BaseModel):
    """Finalise une inspection / Complete inspection."""
    remarks: str | None = None


# --- Read (web) ---

class InspectionPhotoRead(BaseModel):
    id: int
    inspection_id: int
    item_id: int | None = None
    filename: str
    file_size: int | None = None
    mime_type: str | None = None
    uploaded_at: str

    model_config = {"from_attributes": True}


class InspectionItemRead(BaseModel):
    id: int
    inspection_id: int
    template_id: int | None = None
    label: str
    category: str
    result: str
    comment: str | None = None
    is_critical: bool
    requires_photo: bool = False

    model_config = {"from_attributes": True}


class InspectionRead(BaseModel):
    id: int
    vehicle_id: int
    tour_id: int | None = None
    device_id: int | None = None
    inspection_type: str
    status: str
    driver_name: str | None = None
    km_at_inspection: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    started_at: str
    completed_at: str | None = None
    remarks: str | None = None
    has_critical_defect: bool
    items: list[InspectionItemRead] = []
    photos: list[InspectionPhotoRead] = []
    # Extra (populated by API)
    vehicle_code: str | None = None
    vehicle_name: str | None = None

    model_config = {"from_attributes": True}


class InspectionCheckVehicle(BaseModel):
    """Etat inspection d'un vehicule pour un tour / Inspection state for a vehicle on a tour."""
    id: int
    code: str
    name: str | None = None
    fleet_vehicle_type: str
    inspection_done: bool
    inspection_id: int | None = None


class InspectionCheckResponse(BaseModel):
    """Reponse de verification inspection / Inspection check response."""
    required: bool
    vehicles: list[InspectionCheckVehicle] = []


class InspectionStartResponse(BaseModel):
    """Reponse de demarrage inspection / Inspection start response."""
    inspection_id: int
    items: list[InspectionItemRead]
