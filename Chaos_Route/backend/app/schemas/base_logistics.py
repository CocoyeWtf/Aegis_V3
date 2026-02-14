"""Schémas Base Logistique / Logistics Base schemas."""

from pydantic import BaseModel, ConfigDict

from app.models.base_logistics import BaseType


class BaseLogisticsBase(BaseModel):
    code: str
    name: str
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    phone: str | None = None
    email: str | None = None
    longitude: float | None = None
    latitude: float | None = None
    type: BaseType
    region_id: int


class BaseLogisticsCreate(BaseLogisticsBase):
    pass


class BaseLogisticsUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    phone: str | None = None
    email: str | None = None
    longitude: float | None = None
    latitude: float | None = None
    type: BaseType | None = None
    region_id: int | None = None


class BaseLogisticsRead(BaseLogisticsBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
