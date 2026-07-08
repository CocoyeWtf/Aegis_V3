"""
Schémas User et Role / User and Role schemas.
CRUD + read avec permissions aplaties.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator, model_validator

from app.utils.password_policy import validate_password_strength


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
    pdv_id: int | None = None
    supplier_id: int | None = None
    default_route: str | None = None
    tenant_id: int | None = None  # Société d'appartenance ; appliqué par superadmin uniquement

    @field_validator("password")
    @classmethod
    def _check_strength(cls, v: str) -> str:
        return validate_password_strength(v)

    @model_validator(mode="after")
    def _check_privileged_strength(self) -> "UserCreate":
        # Compte superadmin → exigence renforcée (14 caractères)
        if self.is_superadmin:
            validate_password_strength(self.password, privileged=True)
        return self


class UserUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    is_active: bool | None = None
    is_superadmin: bool | None = None
    role_ids: list[int] | None = None
    region_ids: list[int] | None = None
    pdv_id: int | None = None
    supplier_id: int | None = None
    default_route: str | None = None
    tenant_id: int | None = None  # Société d'appartenance ; appliqué par superadmin uniquement

    @field_validator("password")
    @classmethod
    def _check_strength(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return validate_password_strength(v)

    @model_validator(mode="after")
    def _check_privileged_strength(self) -> "UserUpdate":
        # Promotion superadmin + nouveau mot de passe → exigence renforcée.
        # (Cible déjà superadmin : vérifié côté endpoint, le schéma ne la connaît pas.)
        if self.password is not None and self.is_superadmin:
            validate_password_strength(self.password, privileged=True)
        return self


class UserRead(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_superadmin: bool
    tenant_id: int | None = None
    pdv_id: int | None = None
    supplier_id: int | None = None
    badge_code: str | None = None
    default_route: str | None = None
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
    must_change_password: bool = False
    mfa_enabled: bool = False
    pdv_id: int | None = None
    supplier_id: int | None = None
    badge_code: str | None = None
    default_route: str | None = None
    roles: list[RoleBrief]
    regions: list[RegionBrief]
    permissions: list[str]  # ["pdvs:read", "pdvs:create", ...]
    model_config = {"from_attributes": True}
