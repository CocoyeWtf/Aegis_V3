"""Schémas tri vidanges / Bottle sorting schemas."""

from pydantic import BaseModel, ConfigDict


class BottleBrandRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    format: str
    sorting_rule: str
    mix_group: str | None
    bottles_per_crate: int
    deposit_per_bottle: float | None
    is_active: int


class BottleBrandCreate(BaseModel):
    name: str
    format: str  # 25CL | 33CL | 50CL | 75CL
    sorting_rule: str = "FORMAT_MIX"
    mix_group: str | None = None
    crate_support_type_id: int | None = None
    bottles_per_crate: int = 24
    deposit_per_bottle: float | None = None


class SortingLineCreate(BaseModel):
    brand_id: int | None = None
    bottle_format: str
    sorting_rule: str
    full_crates: int = 0
    loose_bottles: int = 0
    damaged_bottles: int = 0
    label: str | None = None


class SortingLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    session_id: int
    brand_id: int | None
    brand_name: str | None = None
    bottle_format: str
    sorting_rule: str
    full_crates: int
    loose_bottles: int
    damaged_bottles: int
    total_bottles: int = 0
    label: str | None


class SortingSessionCreate(BaseModel):
    base_id: int
    session_date: str
    operator_name: str | None = None


class SortingSessionRead(BaseModel):
    id: int
    base_id: int
    base_name: str | None = None
    session_date: str
    status: str
    operator_name: str | None
    started_at: str
    completed_at: str | None
    notes: str | None
    total_crates: int | None
    total_bottles: int | None
    lines: list[SortingLineRead] = []
