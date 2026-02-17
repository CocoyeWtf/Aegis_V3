"""Routes PDV / Point of Sale API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.pdv import PDV
from app.models.user import User
from app.schemas.pdv import PDVCreate, PDVRead, PDVUpdate
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()


@router.get("/", response_model=list[PDVRead])
async def list_pdvs(
    region_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdvs", "read")),
):
    """Lister les PDV / List points of sale."""
    query = select(PDV)
    if region_id is not None:
        query = query.where(PDV.region_id == region_id)
    user_region_ids = get_user_region_ids(user)
    if user_region_ids is not None:
        query = query.where(PDV.region_id.in_(user_region_ids))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{pdv_id}", response_model=PDVRead)
async def get_pdv(
    pdv_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdvs", "read")),
):
    pdv = await db.get(PDV, pdv_id)
    if not pdv:
        raise HTTPException(status_code=404, detail="PDV not found")
    return pdv


@router.post("/", response_model=PDVRead, status_code=201)
async def create_pdv(
    data: PDVCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdvs", "create")),
):
    pdv = PDV(**data.model_dump())
    db.add(pdv)
    await db.flush()
    await db.refresh(pdv)
    return pdv


@router.put("/{pdv_id}", response_model=PDVRead)
async def update_pdv(
    pdv_id: int,
    data: PDVUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdvs", "update")),
):
    pdv = await db.get(PDV, pdv_id)
    if not pdv:
        raise HTTPException(status_code=404, detail="PDV not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(pdv, key, value)
    await db.flush()
    await db.refresh(pdv)
    return pdv


@router.delete("/{pdv_id}", status_code=204)
async def delete_pdv(
    pdv_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdvs", "delete")),
):
    pdv = await db.get(PDV, pdv_id)
    if not pdv:
        raise HTTPException(status_code=404, detail="PDV not found")
    await db.delete(pdv)
