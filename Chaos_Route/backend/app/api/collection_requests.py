"""Routes demandes d'enlevement fournisseur / Supplier collection request API routes.
Les appros declarent des besoins, le transport planifie.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.collection_request import CollectionRequest, CollectionStatus
from app.models.supplier import Supplier
from app.models.base_logistics import BaseLogistics
from app.models.tour import Tour
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.collection_request import (
    CollectionRequestCreate, CollectionRequestRead, CollectionRequestUpdate,
)
from app.api.deps import require_permission

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def _enrich(req: CollectionRequest, db: AsyncSession) -> CollectionRequestRead:
    """Enrichir avec relations / Enrich with relations."""
    supplier = await db.get(Supplier, req.supplier_id)
    base = await db.get(BaseLogistics, req.base_id)
    username = None
    if req.created_by_user_id:
        user = await db.get(User, req.created_by_user_id)
        username = user.username if user else None
    tour_code = None
    if req.tour_id:
        tour = await db.get(Tour, req.tour_id)
        tour_code = tour.code if tour else None

    return CollectionRequestRead(
        id=req.id,
        supplier_id=req.supplier_id,
        base_id=req.base_id,
        eqp_count=req.eqp_count,
        pickup_date=req.pickup_date,
        needed_by_date=req.needed_by_date,
        status=req.status.value if isinstance(req.status, CollectionStatus) else req.status,
        tour_id=req.tour_id,
        transport_notes=req.transport_notes,
        notes=req.notes,
        created_by_user_id=req.created_by_user_id,
        created_at=req.created_at,
        planned_at=req.planned_at,
        picked_up_at=req.picked_up_at,
        delivered_at=req.delivered_at,
        supplier={"id": supplier.id, "code": supplier.code, "name": supplier.name} if supplier else None,
        base={"id": base.id, "code": base.code, "name": base.name} if base else None,
        created_by_username=username,
        tour_code=tour_code,
    )


@router.get("/", response_model=list[CollectionRequestRead])
async def list_collection_requests(
    base_id: int | None = None,
    supplier_id: int | None = None,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(default=200, le=2000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("collection-requests", "read")),
):
    """Lister les demandes d'enlevement / List collection requests."""
    query = select(CollectionRequest)
    if base_id:
        query = query.where(CollectionRequest.base_id == base_id)
    if supplier_id:
        query = query.where(CollectionRequest.supplier_id == supplier_id)
    if status_filter:
        query = query.where(CollectionRequest.status == status_filter)
    query = query.order_by(CollectionRequest.needed_by_date.asc()).offset(offset).limit(limit)

    result = await db.execute(query)
    requests = result.scalars().all()
    return [await _enrich(req, db) for req in requests]


@router.get("/{request_id}", response_model=CollectionRequestRead)
async def get_collection_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("collection-requests", "read")),
):
    """Detail d'une demande / Request detail."""
    req = await db.get(CollectionRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande non trouvee")
    return await _enrich(req, db)


@router.post("/", response_model=CollectionRequestRead, status_code=status.HTTP_201_CREATED)
async def create_collection_request(
    data: CollectionRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("collection-requests", "create")),
):
    """Creer une demande d'enlevement / Create a collection request."""
    now = _now_iso()
    req = CollectionRequest(
        supplier_id=data.supplier_id,
        base_id=data.base_id,
        eqp_count=data.eqp_count,
        pickup_date=data.pickup_date,
        needed_by_date=data.needed_by_date,
        status=CollectionStatus.REQUESTED,
        notes=data.notes,
        created_by_user_id=user.id,
        created_at=now,
    )
    db.add(req)
    await db.flush()

    db.add(AuditLog(
        entity_type="collection_request", entity_id=req.id, action="CREATED",
        changes=f'{{"supplier_id":{data.supplier_id},"eqp_count":{data.eqp_count},"needed_by":"{data.needed_by_date}"}}',
        user=user.username, timestamp=now,
    ))

    return await _enrich(req, db)


@router.put("/{request_id}", response_model=CollectionRequestRead)
async def update_collection_request(
    request_id: int,
    data: CollectionRequestUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("collection-requests", "update")),
):
    """Modifier une demande / Update a request."""
    req = await db.get(CollectionRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande non trouvee")

    now = _now_iso()

    if data.status is not None:
        new_status = CollectionStatus(data.status)
        req.status = new_status
        if new_status == CollectionStatus.PLANNED and not req.planned_at:
            req.planned_at = now
        elif new_status == CollectionStatus.PICKED_UP and not req.picked_up_at:
            req.picked_up_at = now
        elif new_status == CollectionStatus.DELIVERED and not req.delivered_at:
            req.delivered_at = now

    if data.eqp_count is not None:
        req.eqp_count = data.eqp_count
    if data.pickup_date is not None:
        req.pickup_date = data.pickup_date
    if data.needed_by_date is not None:
        req.needed_by_date = data.needed_by_date
    if data.notes is not None:
        req.notes = data.notes
    if data.tour_id is not None:
        req.tour_id = data.tour_id if data.tour_id != 0 else None
    if data.transport_notes is not None:
        req.transport_notes = data.transport_notes

    await db.flush()

    db.add(AuditLog(
        entity_type="collection_request", entity_id=req.id, action="UPDATED",
        changes=f'{{"status":"{req.status.value}"}}',
        user=user.username, timestamp=now,
    ))

    return await _enrich(req, db)


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("collection-requests", "delete")),
):
    """Supprimer une demande / Delete a request (only REQUESTED status)."""
    req = await db.get(CollectionRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande non trouvee")
    if req.status != CollectionStatus.REQUESTED:
        raise HTTPException(status_code=400, detail="Seules les demandes en attente peuvent etre supprimees")
    await db.delete(req)
