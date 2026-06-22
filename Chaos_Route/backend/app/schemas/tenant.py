"""Schémas Tenant / Tenant schemas."""

from pydantic import BaseModel


class TenantRead(BaseModel):
    id: int
    code: str
    name: str
    is_active: bool
    model_config = {"from_attributes": True}
