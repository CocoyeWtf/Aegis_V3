"""Schémas Transporteur / Carrier schemas."""

from pydantic import BaseModel, ConfigDict


class CarrierBase(BaseModel):
    code: str
    name: str
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None
    transport_license: str | None = None
    vat_number: str | None = None
    accounting_code: str | None = None
    contact_person: str | None = None
    notes: str | None = None
    region_id: int


class CarrierCreate(CarrierBase):
    pass


class CarrierUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None
    transport_license: str | None = None
    vat_number: str | None = None
    accounting_code: str | None = None
    contact_person: str | None = None
    notes: str | None = None
    region_id: int | None = None


class CarrierRead(CarrierBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
