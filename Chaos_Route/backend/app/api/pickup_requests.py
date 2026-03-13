"""Routes Demandes de reprise / Pickup Request API routes."""

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.pickup_request import PickupRequest, PickupLabel, PickupMovement, PickupStatus, LabelStatus, PickupType, MovementType
from app.models.support_type import SupportType
from app.models.pdv import PDV
from app.models.pdv_inventory import PdvStock
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


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _enrich_with_label_counts(req: PickupRequest) -> dict:
    """Ajouter les compteurs labels au dict de réponse / Add label counts to response dict."""
    data = PickupRequestListRead.model_validate(req, from_attributes=True)
    if req.labels:
        data.total_labels = len(req.labels)
        data.picked_up_count = sum(1 for lb in req.labels if lb.status == LabelStatus.PICKED_UP)
        data.received_count = sum(1 for lb in req.labels if lb.status == LabelStatus.RECEIVED)
        data.pending_count = sum(1 for lb in req.labels if lb.status in (LabelStatus.PENDING, LabelStatus.PLANNED))
    else:
        data.total_labels = req.quantity
    return data


async def _update_pdv_stock_on_pickup(db: AsyncSession, pdv_id: int, support_type_id: int, delta: int = -1):
    """Mettre à jour le stock PDV lors d'une reprise / Update PDV stock on pickup.
    delta=-1 : chauffeur reprend (stock PDV diminue).
    """
    result = await db.execute(
        select(PdvStock).where(
            PdvStock.pdv_id == pdv_id,
            PdvStock.support_type_id == support_type_id,
        )
    )
    stock = result.scalar_one_or_none()
    if stock:
        stock.current_stock = max(0, stock.current_stock + delta)


def _create_movement(label: PickupLabel, movement_type: MovementType, device_id: int | None = None,
                     user_id: int | None = None, notes: str | None = None) -> PickupMovement:
    """Créer un enregistrement de mouvement / Create a movement record."""
    return PickupMovement(
        pickup_label_id=label.id,
        movement_type=movement_type,
        timestamp=_now_iso(),
        device_id=device_id,
        user_id=user_id,
        notes=notes,
    )


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
    """Liste des demandes de reprise avec filtres et compteurs labels / List pickup requests with filters and label counts."""
    query = select(PickupRequest).options(
        selectinload(PickupRequest.pdv),
        selectinload(PickupRequest.support_type),
        selectinload(PickupRequest.labels),
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
    requests = result.scalars().all()
    return [_enrich_with_label_counts(req) for req in requests]


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
        entry["requests"].append(_enrich_with_label_counts(req))

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
    label.received_at = _now_iso()

    # Mouvement traçabilité / Traceability movement
    db.add(_create_movement(label, MovementType.RECEIVED, user_id=user.id))

    # Auto-progression de la demande parent / Auto-progress parent request
    _auto_progress_request(label.pickup_request)

    await db.flush()
    await db.refresh(label)
    return label


@router.get("/export/csv")
async def export_pickup_requests_csv(
    pdv_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    pickup_type: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "read")),
):
    """Export CSV des demandes de reprise / CSV export of pickup requests."""
    query = select(PickupRequest).options(
        selectinload(PickupRequest.pdv),
        selectinload(PickupRequest.support_type),
    ).order_by(PickupRequest.availability_date.desc(), PickupRequest.id.desc())

    if pdv_id is not None:
        query = query.where(PickupRequest.pdv_id == pdv_id)
    if status is not None:
        query = query.where(PickupRequest.status == status)
    if pickup_type is not None:
        query = query.where(PickupRequest.pickup_type == pickup_type)
    if date_from is not None:
        query = query.where(PickupRequest.availability_date >= date_from)
    if date_to is not None:
        query = query.where(PickupRequest.availability_date <= date_to)

    result = await db.execute(query)
    requests = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_ALL)

    # En-têtes / Headers
    writer.writerow([
        "PDV code", "PDV nom", "Type reprise", "Support", "Qté",
        "Avec contenu", "Date disponibilité",
        "Valeur unitaire (€)", "Valeur contenu/unité (€)", "Valeur totale (€)",
        "Statut", "Demandé le", "Notes",
    ])

    for req in requests:
        pdv_code = req.pdv.code if req.pdv else ""
        pdv_name = req.pdv.name if req.pdv else ""
        support_name = req.support_type.name if req.support_type else ""
        avec_contenu = "Oui" if req.with_content else "Non"
        val_unitaire = f"{req.declared_unit_value:.2f}".replace(".", ",") if req.declared_unit_value is not None else ""
        val_contenu = ""
        if req.declared_content_item_value is not None and req.declared_content_items_per_unit is not None:
            val_contenu = f"{float(req.declared_content_item_value) * req.declared_content_items_per_unit:.4f}".replace(".", ",")
        val_totale = f"{req.total_declared_value:.2f}".replace(".", ",") if req.total_declared_value is not None else ""
        demande_le = req.requested_at.strftime("%Y-%m-%d %H:%M") if isinstance(req.requested_at, datetime) else (str(req.requested_at)[:16] if req.requested_at else "")

        writer.writerow([
            pdv_code, pdv_name, req.pickup_type, support_name, req.quantity,
            avec_contenu, req.availability_date,
            val_unitaire, val_contenu, val_totale,
            req.status, demande_le, req.notes or "",
        ])

    output.seek(0)
    filename = f"reprises_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
        # Snapshots valeur au moment de la déclaration / Value snapshots at declaration time
        with_content=data.with_content,
        declared_unit_value=float(st.unit_value) if st.unit_value is not None else None,
        declared_unit_quantity=st.unit_quantity,
        declared_content_item_value=float(st.content_item_value) if st.content_item_value is not None else None,
        declared_content_items_per_unit=st.content_items_per_unit,
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

    # Générer les étiquettes + mouvements / Generate labels + movements
    for i in range(data.quantity):
        seq = start_seq + i
        label = PickupLabel(
            pickup_request_id=req.id,
            label_code=_generate_label_code(pdv.code, st.code, data.availability_date, seq),
            sequence_number=i + 1,
            status=LabelStatus.PENDING,
        )
        db.add(label)
        await db.flush()  # Pour obtenir label.id
        db.add(_create_movement(label, MovementType.REQUESTED, user_id=user.id))

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
    """Auto-progression basée sur les statuts individuels des étiquettes.
    Auto-progress based on individual label statuses.
    - Tous RECEIVED → RECEIVED
    - Tous PICKED_UP (ou mix PICKED_UP/RECEIVED) → PICKED_UP
    - Tous PLANNED → PLANNED
    - Sinon statut le plus avancé
    """
    if not request.labels:
        return

    statuses = {lb.status for lb in request.labels}

    if statuses == {LabelStatus.RECEIVED}:
        request.status = PickupStatus.RECEIVED
    elif LabelStatus.RECEIVED in statuses:
        # Mix RECEIVED + autre → PICKED_UP (en transit partiel)
        request.status = PickupStatus.PICKED_UP
    elif LabelStatus.PICKED_UP in statuses:
        request.status = PickupStatus.PICKED_UP
    elif statuses == {LabelStatus.PLANNED}:
        request.status = PickupStatus.PLANNED


@router.get("/{request_id}/movements")
async def get_request_movements(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "read")),
):
    """Historique mouvements d'une demande / Movement history for a request."""
    result = await db.execute(
        select(PickupMovement)
        .join(PickupLabel, PickupMovement.pickup_label_id == PickupLabel.id)
        .where(PickupLabel.pickup_request_id == request_id)
        .order_by(PickupMovement.timestamp.desc())
    )
    movements = result.scalars().all()
    return [
        {
            "id": m.id,
            "label_id": m.pickup_label_id,
            "movement_type": m.movement_type.value if hasattr(m.movement_type, "value") else m.movement_type,
            "timestamp": m.timestamp,
            "device_id": m.device_id,
            "user_id": m.user_id,
            "notes": m.notes,
        }
        for m in movements
    ]


@router.get("/discrepancies/", response_model=list[PickupRequestListRead])
async def list_discrepancies(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "read")),
):
    """Demandes avec écarts chauffeur/base / Requests with driver/base discrepancies.
    Retourne les demandes où picked_up_count != received_count (écart = perte potentielle).
    Returns requests where picked_up_count != received_count (gap = potential loss).
    """
    query = select(PickupRequest).options(
        selectinload(PickupRequest.pdv),
        selectinload(PickupRequest.support_type),
        selectinload(PickupRequest.labels),
    ).where(PickupRequest.status == PickupStatus.PICKED_UP)

    result = await db.execute(query)
    requests = result.scalars().all()

    discrepancies = []
    for req in requests:
        picked = sum(1 for lb in req.labels if lb.status in (LabelStatus.PICKED_UP, LabelStatus.RECEIVED))
        received = sum(1 for lb in req.labels if lb.status == LabelStatus.RECEIVED)
        # Ecart = des labels repris mais pas encore reçus (perte potentielle)
        if picked > 0 and received < picked:
            discrepancies.append(_enrich_with_label_counts(req))

    return discrepancies
