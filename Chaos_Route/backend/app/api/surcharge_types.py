"""Routes Types de surcharge / Surcharge Type API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.surcharge_type import SurchargeType
from app.models.user import User
from app.schemas.surcharge import SurchargeTypeCreate, SurchargeTypeRead, SurchargeTypeUpdate
from app.api.deps import require_permission

router = APIRouter()


@router.get("/", response_model=list[SurchargeTypeRead])
async def list_surcharge_types(
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("surcharge-types", "read")),
):
    """Liste des types de surcharge / List surcharge types."""
    query = select(SurchargeType)
    if is_active is not None:
        query = query.where(SurchargeType.is_active == is_active)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=SurchargeTypeRead, status_code=201)
async def create_surcharge_type(
    data: SurchargeTypeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("surcharge-types", "create")),
):
    """Créer un type de surcharge / Create a surcharge type."""
    st = SurchargeType(**data.model_dump())
    db.add(st)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Le code '{data.code}' existe deja")
    await db.refresh(st)
    return st


@router.put("/{surcharge_type_id}", response_model=SurchargeTypeRead)
async def update_surcharge_type(
    surcharge_type_id: int,
    data: SurchargeTypeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("surcharge-types", "update")),
):
    """Modifier un type de surcharge / Update a surcharge type."""
    st = await db.get(SurchargeType, surcharge_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Type de surcharge non trouvé")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(st, key, value)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Le code '{data.code}' existe deja")
    await db.refresh(st)
    return st


@router.delete("/{surcharge_type_id}", status_code=204)
async def delete_surcharge_type(
    surcharge_type_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("surcharge-types", "delete")),
):
    """Supprimer un type de surcharge / Delete a surcharge type."""
    st = await db.get(SurchargeType, surcharge_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Type de surcharge non trouvé")
    await db.delete(st)
