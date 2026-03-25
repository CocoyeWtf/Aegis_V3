"""Schemas scan combi / Combi scan schemas."""

from pydantic import BaseModel, ConfigDict, Field


class CombiScanCreate(BaseModel):
    """Scan d'un combi par le chauffeur / Combi scan by driver."""
    barcode: str = Field(min_length=1, max_length=50)
    pdv_code_scanned: str = Field(min_length=1, max_length=20)
    timestamp: str = Field(max_length=32)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accuracy: float | None = None


class CombiScanRead(BaseModel):
    """Lecture d'un scan combi / Combi scan read."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    barcode: str
    scan_context: str
    pdv_id: int | None = None
    pdv_code_scanned: str | None = None
    pdv_name: str | None = None
    device_id: int | None = None
    timestamp: str
    latitude: float | None = None
    longitude: float | None = None
    accuracy: float | None = None
    scan_date: str


class CombiReceiveCreate(BaseModel):
    """Re-scan d'un combi a la base / Combi re-scan at base reception."""
    barcode: str = Field(min_length=1, max_length=50)
    timestamp: str = Field(max_length=32)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accuracy: float | None = None
