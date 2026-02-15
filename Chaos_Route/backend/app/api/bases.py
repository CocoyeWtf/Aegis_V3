"""Routes Bases Logistiques / Logistics Base API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.base_logistics import BaseLogistics
from app.models.base_activity import BaseActivity
from app.schemas.base_logistics import BaseLogisticsCreate, BaseLogisticsRead, BaseLogisticsUpdate

router = APIRouter()


@router.get("/", response_model=list[BaseLogisticsRead])
async def list_bases(region_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """Lister les bases logistiques / List logistics bases."""
    query = select(BaseLogistics)
    if region_id is not None:
        query = query.where(BaseLogistics.region_id == region_id)
    result = await db.execute(query)
    return result.scalars().unique().all()


@router.get("/{base_id}", response_model=BaseLogisticsRead)
async def get_base(base_id: int, db: AsyncSession = Depends(get_db)):
    base = await db.get(BaseLogistics, base_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base not found")
    return base


@router.post("/", response_model=BaseLogisticsRead, status_code=201)
async def create_base(data: BaseLogisticsCreate, db: AsyncSession = Depends(get_db)):
    payload = data.model_dump(exclude={"activity_ids"})
    base = BaseLogistics(**payload)
    if data.activity_ids:
        result = await db.execute(select(BaseActivity).where(BaseActivity.id.in_(data.activity_ids)))
        base.activities = list(result.scalars().all())
    db.add(base)
    await db.flush()
    await db.refresh(base)
    return base


@router.put("/{base_id}", response_model=BaseLogisticsRead)
async def update_base(base_id: int, data: BaseLogisticsUpdate, db: AsyncSession = Depends(get_db)):
    base = await db.get(BaseLogistics, base_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base not found")
    update_data = data.model_dump(exclude_unset=True, exclude={"activity_ids"})
    for key, value in update_data.items():
        setattr(base, key, value)
    if data.activity_ids is not None:
        result = await db.execute(select(BaseActivity).where(BaseActivity.id.in_(data.activity_ids)))
        base.activities = list(result.scalars().all())
    await db.flush()
    await db.refresh(base)
    return base


@router.delete("/{base_id}", status_code=204)
async def delete_base(base_id: int, db: AsyncSession = Depends(get_db)):
    base = await db.get(BaseLogistics, base_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base not found")
    await db.delete(base)
