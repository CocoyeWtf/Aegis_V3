"""
CRUD Rôles / Role CRUD routes.
Protégé par permissions "roles" / Protected by "roles" permissions.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import Role, Permission, User
from app.schemas.user import RoleCreate, RoleRead, RoleUpdate
from app.api.deps import require_permission

router = APIRouter()


@router.get("/", response_model=list[RoleRead])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("roles", "read")),
):
    """Lister tous les rôles / List all roles."""
    result = await db.execute(select(Role).order_by(Role.name))
    return result.scalars().all()


@router.get("/{role_id}", response_model=RoleRead)
async def get_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("roles", "read")),
):
    """Obtenir un rôle / Get a role."""
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.post("/", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("roles", "create")),
):
    """Créer un rôle / Create a role."""
    existing = await db.execute(select(Role).where(Role.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role name already exists")

    role = Role(name=data.name, description=data.description)
    role.permissions = [
        Permission(resource=p.resource, action=p.action) for p in data.permissions
    ]
    db.add(role)
    await db.flush()
    await db.refresh(role)
    return role


@router.put("/{role_id}", response_model=RoleRead)
async def update_role(
    role_id: int,
    data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("roles", "update")),
):
    """Modifier un rôle / Update a role."""
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if data.name is not None:
        role.name = data.name
    if data.description is not None:
        role.description = data.description

    if data.permissions is not None:
        # Remplacer toutes les permissions / Replace all permissions
        role.permissions.clear()
        await db.flush()
        role.permissions = [
            Permission(resource=p.resource, action=p.action, role_id=role.id) for p in data.permissions
        ]

    await db.flush()
    await db.refresh(role)
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("roles", "delete")),
):
    """Supprimer un rôle / Delete a role."""
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    await db.delete(role)
