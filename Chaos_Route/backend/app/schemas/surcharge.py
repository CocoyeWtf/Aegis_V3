"""Schémas Surcharge / Surcharge schemas."""

from pydantic import BaseModel, ConfigDict, Field


# ---- SurchargeType schemas ----

class SurchargeTypeCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    label: str = Field(..., min_length=1, max_length=100)
    is_active: bool = True


class SurchargeTypeUpdate(BaseModel):
    code: str | None = None
    label: str | None = None
    is_active: bool | None = None


class SurchargeTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    label: str
    is_active: bool


# ---- TourSurcharge schemas ----

class SurchargeCreate(BaseModel):
    tour_id: int
    amount: float = Field(..., gt=0)
    surcharge_type_id: int
    comment: str | None = None


class SurchargeValidate(BaseModel):
    password: str


class SurchargeDelete(BaseModel):
    password: str


class SurchargeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tour_id: int
    amount: float
    surcharge_type_id: int | None = None
    surcharge_type_label: str = ""
    comment: str | None = None
    motif: str = ""
    status: str
    created_by_id: int
    created_at: str
    validated_by_id: int | None = None
    validated_at: str | None = None
    created_by_username: str = ""
    validated_by_username: str | None = None
