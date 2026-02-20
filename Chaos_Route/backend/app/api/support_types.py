"""Routes Types de support / Support Type API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.support_type import SupportType
from app.models.user import User
from app.schemas.pickup import SupportTypeCreate, SupportTypeRead, SupportTypeUpdate
from app.api.deps import require_permission

router = APIRouter()


@router.get("/", response_model=list[SupportTypeRead])
async def list_support_types(
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "read")),
):
    """Liste des types de support / List support types."""
    query = select(SupportType)
    if is_active is not None:
        query = query.where(SupportType.is_active == is_active)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{support_type_id}", response_model=SupportTypeRead)
async def get_support_type(
    support_type_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "read")),
):
    """Détail d'un type de support / Support type detail."""
    st = await db.get(SupportType, support_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Support type not found")
    return st


@router.post("/", response_model=SupportTypeRead, status_code=201)
async def create_support_type(
    data: SupportTypeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "create")),
):
    """Créer un type de support / Create a support type."""
    st = SupportType(**data.model_dump())
    db.add(st)
    await db.flush()
    await db.refresh(st)
    return st


@router.put("/{support_type_id}", response_model=SupportTypeRead)
async def update_support_type(
    support_type_id: int,
    data: SupportTypeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "update")),
):
    """Modifier un type de support / Update a support type."""
    st = await db.get(SupportType, support_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Support type not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(st, key, value)
    await db.flush()
    await db.refresh(st)
    return st


@router.delete("/{support_type_id}", status_code=204)
async def delete_support_type(
    support_type_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "delete")),
):
    """Supprimer un type de support / Delete a support type."""
    st = await db.get(SupportType, support_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Support type not found")
    await db.delete(st)
