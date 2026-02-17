"""
Schémas User et Role / User and Role schemas.
CRUD + read avec permissions aplaties.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr


# --- Permission ---
class PermissionRead(BaseModel):
    id: int
    resource: str
    action: str
    model_config = {"from_attributes": True}


class PermissionInput(BaseModel):
    resource: str
    action: str


# --- Role ---
class RoleCreate(BaseModel):
    name: str
    description: str | None = None
    permissions: list[PermissionInput] = []


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    permissions: list[PermissionInput] | None = None


class RoleRead(BaseModel):
    id: int
    name: str
    description: str | None
    permissions: list[PermissionRead]
    created_at: datetime
    model_config = {"from_attributes": True}


class RoleBrief(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


# --- Region brief (pour UserRead) ---
class RegionBrief(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


# --- User ---
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    is_active: bool = True
    is_superadmin: bool = False
    role_ids: list[int] = []
    region_ids: list[int] = []


class UserUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    is_active: bool | None = None
    is_superadmin: bool | None = None
    role_ids: list[int] | None = None
    region_ids: list[int] | None = None


class UserRead(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_superadmin: bool
    roles: list[RoleBrief]
    regions: list[RegionBrief]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class UserMe(BaseModel):
    """Profil utilisateur avec permissions aplaties / User profile with flat permissions."""
    id: int
    username: str
    email: str
    is_superadmin: bool
    roles: list[RoleBrief]
    regions: list[RegionBrief]
    permissions: list[str]  # ["pdvs:read", "pdvs:create", ...]
    model_config = {"from_attributes": True}
