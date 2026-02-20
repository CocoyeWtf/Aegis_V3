"""Routes Demandes de reprise / Pickup Request API routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.pickup_request import PickupRequest, PickupLabel, PickupStatus, LabelStatus, PickupType
from app.models.support_type import SupportType
from app.models.pdv import PDV
from app.models.user import User
from app.schemas.pickup import (
    PickupRequestCreate,
    PickupRequestRead,
    PickupRequestListRead,
    PickupRequestUpdate,
    PickupLabelRead,
    PdvPickupSummary,
)
from app.api.deps import require_permission

router = APIRouter()


def _generate_label_code(pdv_code: str, support_code: str, date_str: str, seq: int) -> str:
    """Générer le code étiquette / Generate label code.
    Format : RET-{PDV_CODE}-{SUPPORT_CODE}-{YYYYMMDD}-{SEQ:03d}
    """
    date_compact = date_str.replace("-", "")
    return f"RET-{pdv_code}-{support_code}-{date_compact}-{seq:03d}"


@router.get("/", response_model=list[PickupRequestListRead])
async def list_pickup_requests(
    pdv_id: int | None = None,
    status: str | None = None,
    pickup_type: str | None = None,
    availability_date: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "read")),
):
    """Liste des demandes de reprise avec filtres / List pickup requests with filters."""
    query = select(PickupRequest).options(
        selectinload(PickupRequest.pdv),
        selectinload(PickupRequest.support_type),
    ).order_by(PickupRequest.id.desc())

    if pdv_id is not None:
        query = query.where(PickupRequest.pdv_id == pdv_id)
    if status is not None:
        query = query.where(PickupRequest.status == status)
    if pickup_type is not None:
        query = query.where(PickupRequest.pickup_type == pickup_type)
    if availability_date is not None:
        query = query.where(PickupRequest.availability_date == availability_date)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/by-pdv/pending/", response_model=list[PdvPickupSummary])
async def pending_by_pdv(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "read")),
):
    """Résumé des reprises en attente par PDV (pour planning) / Pending pickups summary by PDV (for planning)."""
    query = (
        select(PickupRequest)
        .where(PickupRequest.status.in_([PickupStatus.REQUESTED, PickupStatus.PLANNED]))
        .options(
            selectinload(PickupRequest.pdv),
            selectinload(PickupRequest.support_type),
            selectinload(PickupRequest.labels),
        )
    )
    result = await db.execute(query)
    requests = result.scalars().all()

    # Grouper par PDV en dicts puis construire les schemas /
    # Group by PDV as dicts then build schemas
    pdv_map: dict[int, dict] = {}
    for req in requests:
        if req.pdv_id not in pdv_map:
            pdv_map[req.pdv_id] = {
                "pdv_id": req.pdv_id,
                "pdv_code": req.pdv.code,
                "pdv_name": req.pdv.name,
                "pending_count": 0,
                "requests": [],
            }
        entry = pdv_map[req.pdv_id]
        pending_labels = sum(1 for lb in req.labels if lb.status in (LabelStatus.PENDING, LabelStatus.PLANNED))
        entry["pending_count"] += pending_labels
        entry["requests"].append(PickupRequestListRead.model_validate(req, from_attributes=True))

    return [PdvPickupSummary(**v) for v in pdv_map.values()]


@router.get("/labels/{label_code}", response_model=PickupLabelRead)
async def get_label_by_code(
    label_code: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "read")),
):
    """Lookup étiquette par code (impression/scan) / Label lookup by code (print/scan)."""
    result = await db.execute(select(PickupLabel).where(PickupLabel.label_code == label_code))
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    return label


@router.post("/labels/receive", response_model=PickupLabelRead)
async def receive_label(
    label_code: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "update")),
):
    """Scan réception base → statut RECEIVED / Base reception scan → status RECEIVED."""
    result = await db.execute(
        select(PickupLabel)
        .where(PickupLabel.label_code == label_code)
        .options(selectinload(PickupLabel.pickup_request).selectinload(PickupRequest.labels))
    )
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    if label.status == LabelStatus.RECEIVED:
        raise HTTPException(status_code=400, detail="Label already received")

    label.status = LabelStatus.RECEIVED
    label.received_at = datetime.now(timezone.utc).isoformat()

    # Auto-progression de la demande parent / Auto-progress parent request
    _auto_progress_request(label.pickup_request)

    await db.flush()
    await db.refresh(label)
    return label


@router.get("/{request_id}", response_model=PickupRequestRead)
async def get_pickup_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "read")),
):
    """Détail d'une demande avec étiquettes / Request detail with labels."""
    result = await db.execute(
        select(PickupRequest)
        .where(PickupRequest.id == request_id)
        .options(
            selectinload(PickupRequest.pdv),
            selectinload(PickupRequest.support_type),
            selectinload(PickupRequest.labels),
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    return req


@router.post("/", response_model=PickupRequestRead, status_code=201)
async def create_pickup_request(
    data: PickupRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "create")),
):
    """Créer une demande + auto-générer N étiquettes / Create request + auto-generate N labels."""
    # Valider PDV et SupportType / Validate PDV and SupportType
    pdv = await db.get(PDV, data.pdv_id)
    if not pdv:
        raise HTTPException(status_code=404, detail="PDV not found")
    st = await db.get(SupportType, data.support_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Support type not found")

    req = PickupRequest(
        pdv_id=data.pdv_id,
        support_type_id=data.support_type_id,
        quantity=data.quantity,
        availability_date=data.availability_date,
        pickup_type=data.pickup_type,
        status=PickupStatus.REQUESTED,
        requested_by_user_id=user.id,
        notes=data.notes,
    )
    db.add(req)
    await db.flush()

    # Trouver le prochain numéro de séquence pour ce PDV/date / Find next sequence for this PDV/date
    existing_count_result = await db.execute(
        select(func.count(PickupLabel.id))
        .join(PickupRequest)
        .where(
            PickupRequest.pdv_id == data.pdv_id,
            PickupRequest.availability_date == data.availability_date,
            PickupLabel.pickup_request_id != req.id,
        )
    )
    start_seq = (existing_count_result.scalar() or 0) + 1

    # Générer les étiquettes / Generate labels
    for i in range(data.quantity):
        seq = start_seq + i
        label = PickupLabel(
            pickup_request_id=req.id,
            label_code=_generate_label_code(pdv.code, st.code, data.availability_date, seq),
            sequence_number=i + 1,
            status=LabelStatus.PENDING,
        )
        db.add(label)

    await db.flush()

    # Reload avec relations / Reload with relations
    result = await db.execute(
        select(PickupRequest)
        .where(PickupRequest.id == req.id)
        .options(
            selectinload(PickupRequest.pdv),
            selectinload(PickupRequest.support_type),
            selectinload(PickupRequest.labels),
        )
    )
    return result.scalar_one()


@router.put("/{request_id}", response_model=PickupRequestRead)
async def update_pickup_request(
    request_id: int,
    data: PickupRequestUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "update")),
):
    """Mise à jour statut/notes / Update status/notes."""
    result = await db.execute(
        select(PickupRequest)
        .where(PickupRequest.id == request_id)
        .options(
            selectinload(PickupRequest.pdv),
            selectinload(PickupRequest.support_type),
            selectinload(PickupRequest.labels),
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Pickup request not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(req, key, value)

    await db.flush()
    await db.refresh(req)
    return req


@router.delete("/{request_id}", status_code=204)
async def delete_pickup_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "delete")),
):
    """Annuler une demande (seulement si REQUESTED) / Cancel request (only if REQUESTED)."""
    req = await db.get(PickupRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    if req.status != PickupStatus.REQUESTED:
        raise HTTPException(status_code=400, detail="Can only delete requests with REQUESTED status")
    await db.delete(req)


def _auto_progress_request(request: PickupRequest):
    """Auto-progression : si toutes les étiquettes ont le même statut, la demande suit.
    Auto-progress: if all labels have the same status, the request follows.
    """
    if not request.labels:
        return

    statuses = {lb.status for lb in request.labels}

    if statuses == {LabelStatus.RECEIVED}:
        request.status = PickupStatus.RECEIVED
    elif statuses == {LabelStatus.PICKED_UP}:
        request.status = PickupStatus.PICKED_UP
    elif LabelStatus.PICKED_UP in statuses or LabelStatus.RECEIVED in statuses:
        request.status = PickupStatus.PICKED_UP
    elif statuses == {LabelStatus.PLANNED}:
        request.status = PickupStatus.PLANNED
