"""Schemas declarations chauffeur / Driver declaration schemas."""

from pydantic import BaseModel


class DeclarationCreate(BaseModel):
    """Creation declaration depuis le mobile / Create declaration from mobile."""
    tour_id: int | None = None
    tour_stop_id: int | None = None
    declaration_type: str  # ANOMALY, BREAKAGE, ACCIDENT, VEHICLE_ISSUE, CLIENT_ISSUE, OTHER
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    accuracy: float | None = None
    driver_name: str | None = None
    created_at: str | None = None  # ISO 8601, fallback to server time


class DeclarationRead(BaseModel):
    """Lecture declaration / Read declaration."""
    id: int
    device_id: int
    tour_id: int | None = None
    tour_stop_id: int | None = None
    declaration_type: str
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    accuracy: float | None = None
    driver_name: str | None = None
    created_at: str
    photos: list["DeclarationPhotoRead"] = []

    model_config = {"from_attributes": True}


class DeclarationPhotoRead(BaseModel):
    """Lecture photo declaration / Read declaration photo."""
    id: int
    declaration_id: int
    filename: str
    file_size: int | None = None
    mime_type: str | None = None
    uploaded_at: str

    model_config = {"from_attributes": True}
