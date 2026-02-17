"""Routes Fournisseurs / Supplier API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.supplier import SupplierCreate, SupplierRead, SupplierUpdate
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()


@router.get("/", response_model=list[SupplierRead])
async def list_suppliers(
    region_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("suppliers", "read")),
):
    query = select(Supplier)
    if region_id is not None:
        query = query.where(Supplier.region_id == region_id)
    user_region_ids = get_user_region_ids(user)
    if user_region_ids is not None:
        query = query.where(Supplier.region_id.in_(user_region_ids))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{supplier_id}", response_model=SupplierRead)
async def get_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("suppliers", "read")),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.post("/", response_model=SupplierRead, status_code=201)
async def create_supplier(
    data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("suppliers", "create")),
):
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    await db.flush()
    await db.refresh(supplier)
    return supplier


@router.put("/{supplier_id}", response_model=SupplierRead)
async def update_supplier(
    supplier_id: int,
    data: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("suppliers", "update")),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    await db.flush()
    await db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=204)
async def delete_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("suppliers", "delete")),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    await db.delete(supplier)
