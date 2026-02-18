"""Schémas Taxe au kilomètre / Km tax schemas."""

from pydantic import BaseModel, ConfigDict


class KmTaxBase(BaseModel):
    origin_type: str
    origin_id: int
    destination_type: str
    destination_id: int
    tax_per_km: float


class KmTaxCreate(KmTaxBase):
    pass


class KmTaxUpdate(BaseModel):
    tax_per_km: float | None = None


class KmTaxRead(KmTaxBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    origin_label: str | None = None
    destination_label: str | None = None
