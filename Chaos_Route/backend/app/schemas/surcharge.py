"""Schémas Surcharge / Surcharge schemas."""

from pydantic import BaseModel, ConfigDict, Field


class SurchargeCreate(BaseModel):
    tour_id: int
    amount: float = Field(..., gt=0)
    motif: str = Field(..., min_length=1, max_length=500)


class SurchargeValidate(BaseModel):
    password: str


class SurchargeDelete(BaseModel):
    password: str


class SurchargeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tour_id: int
    amount: float
    motif: str
    status: str
    created_by_id: int
    created_at: str
    validated_by_id: int | None = None
    validated_at: str | None = None
    created_by_username: str = ""
    validated_by_username: str | None = None
