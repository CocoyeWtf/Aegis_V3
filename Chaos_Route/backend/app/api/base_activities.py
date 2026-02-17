"""Routes Activités de base / Base Activity API routes."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.base_activity import BaseActivity
from app.models.user import User
from app.api.deps import require_permission

router = APIRouter()


class BaseActivityCreate(BaseModel):
    code: str
    name: str


class BaseActivityUpdate(BaseModel):
    code: str | None = None
    name: str | None = None


class BaseActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str


@router.get("/", response_model=list[BaseActivityRead])
async def list_activities(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("base-activities", "read")),
):
    """Lister les activités / List all base activities."""
    result = await db.execute(select(BaseActivity).order_by(BaseActivity.code))
    return result.scalars().all()


@router.post("/", response_model=BaseActivityRead, status_code=201)
async def create_activity(
    data: BaseActivityCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("base-activities", "create")),
):
    activity = BaseActivity(**data.model_dump())
    db.add(activity)
    await db.flush()
    await db.refresh(activity)
    return activity


@router.put("/{activity_id}", response_model=BaseActivityRead)
async def update_activity(
    activity_id: int,
    data: BaseActivityUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("base-activities", "update")),
):
    activity = await db.get(BaseActivity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(activity, key, value)
    await db.flush()
    await db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("base-activities", "delete")),
):
    activity = await db.get(BaseActivity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    await db.delete(activity)
