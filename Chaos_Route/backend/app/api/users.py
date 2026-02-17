"""
CRUD Utilisateurs / User CRUD routes.
Protégé par permissions "users" / Protected by "users" permissions.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, Role, user_roles, user_regions
from app.models.region import Region
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.api.deps import require_permission
from app.utils.auth import hash_password

router = APIRouter()


@router.get("/", response_model=list[UserRead])
async def list_users(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("users", "read")),
):
    """Lister tous les utilisateurs / List all users."""
    result = await db.execute(select(User).order_by(User.username))
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("users", "read")),
):
    """Obtenir un utilisateur / Get a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return target


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("users", "create")),
):
    """Créer un utilisateur / Create a user."""
    # Vérifier unicité / Check uniqueness
    existing = await db.execute(
        select(User).where((User.username == data.username) | (User.email == data.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already exists")

    new_user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        is_active=data.is_active,
        is_superadmin=data.is_superadmin,
    )

    # Attacher les rôles / Attach roles
    if data.role_ids:
        roles_result = await db.execute(select(Role).where(Role.id.in_(data.role_ids)))
        new_user.roles = list(roles_result.scalars().all())

    # Attacher les régions / Attach regions
    if data.region_ids:
        regions_result = await db.execute(select(Region).where(Region.id.in_(data.region_ids)))
        new_user.regions = list(regions_result.scalars().all())

    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    return new_user


@router.put("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("users", "update")),
):
    """Modifier un utilisateur / Update a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if data.username is not None:
        target.username = data.username
    if data.email is not None:
        target.email = data.email
    if data.password is not None:
        target.hashed_password = hash_password(data.password)
    if data.is_active is not None:
        target.is_active = data.is_active
    if data.is_superadmin is not None:
        target.is_superadmin = data.is_superadmin

    if data.role_ids is not None:
        roles_result = await db.execute(select(Role).where(Role.id.in_(data.role_ids)))
        target.roles = list(roles_result.scalars().all())

    if data.region_ids is not None:
        regions_result = await db.execute(select(Region).where(Region.id.in_(data.region_ids)))
        target.regions = list(regions_result.scalars().all())

    await db.flush()
    await db.refresh(target)
    return target


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("users", "delete")),
):
    """Supprimer un utilisateur / Delete a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.is_superadmin:
        raise HTTPException(status_code=400, detail="Cannot delete superadmin")
    await db.delete(target)
