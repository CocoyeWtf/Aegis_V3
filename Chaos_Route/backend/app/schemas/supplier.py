"""Schémas Fournisseur / Supplier schemas."""

from pydantic import BaseModel, ConfigDict


class SupplierBase(BaseModel):
    code: str
    name: str
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    phone: str | None = None
    email: str | None = None
    longitude: float | None = None
    latitude: float | None = None
    region_id: int


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    phone: str | None = None
    email: str | None = None
    longitude: float | None = None
    latitude: float | None = None
    region_id: int | None = None


class SupplierRead(SupplierBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
