"""Routes demandes de casiers / Crate request routes.

PDV : creer des demandes + voir les siennes.
Service vidange / base : voir toutes les demandes, changer le statut.
Admin : CRUD complet crate_types + crate_requests.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.crate_type import CrateType
from app.models.crate_request import CrateRequest, CrateRequestStatus
from app.models.pdv import PDV
from app.models.user import User
from app.schemas.crate import (
    CrateTypeCreate, CrateTypeUpdate, CrateTypeRead,
    CrateRequestCreate, CrateRequestRead, CrateRequestStatusUpdate,
)
from app.api.deps import require_permission, enforce_pdv_scope

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ── CrateType CRUD (admin) ───────────────────────────────────────────────────

@router.get("/types", response_model=list[CrateTypeRead])
async def list_crate_types(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("crate-requests", "read")),
):
    """Lister les types de casiers / List crate types."""
    query = select(CrateType).order_by(CrateType.format, CrateType.name)
    if active_only:
        query = query.where(CrateType.is_active == True)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/types", response_model=CrateTypeRead, status_code=201)
async def create_crate_type(
    data: CrateTypeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("crate-types", "create")),
):
    """Creer un type de casier / Create a crate type."""
    ct = CrateType(
        code=data.code,
        name=data.name,
        format=data.format,
        brand=data.brand,
        sorting_rule=data.sorting_rule,
        is_active=data.is_active,
    )
    db.add(ct)
    await db.flush()
    await db.refresh(ct)
    return ct


@router.put("/types/{crate_type_id}", response_model=CrateTypeRead)
async def update_crate_type(
    crate_type_id: int,
    data: CrateTypeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("crate-types", "update")),
):
    """Modifier un type de casier / Update a crate type."""
    ct = await db.get(CrateType, crate_type_id)
    if not ct:
        raise HTTPException(status_code=404, detail="Crate type not found")
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(ct, key, value)
    await db.flush()
    await db.refresh(ct)
    return ct


@router.delete("/types/{crate_type_id}", status_code=204)
async def delete_crate_type(
    crate_type_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("crate-types", "delete")),
):
    """Supprimer un type de casier / Delete a crate type."""
    ct = await db.get(CrateType, crate_type_id)
    if not ct:
        raise HTTPException(status_code=404, detail="Crate type not found")
    await db.delete(ct)


# ── CrateRequest endpoints ───────────────────────────────────────────────────

@router.get("/", response_model=list[CrateRequestRead])
async def list_crate_requests(
    pdv_id: int | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("crate-requests", "read")),
):
    """Lister les demandes de casiers / List crate requests."""
    # Forcer le scope PDV si utilisateur PDV
    forced_pdv = enforce_pdv_scope(user, pdv_id)

    query = select(CrateRequest).order_by(CrateRequest.id.desc())
    if forced_pdv is not None:
        query = query.where(CrateRequest.pdv_id == forced_pdv)
    elif pdv_id is not None:
        query = query.where(CrateRequest.pdv_id == pdv_id)
    if status is not None:
        query = query.where(CrateRequest.status == CrateRequestStatus(status))

    result = await db.execute(query)
    requests = result.scalars().all()

    # Charger relations en batch
    pdv_ids = {r.pdv_id for r in requests}
    ct_ids = {r.crate_type_id for r in requests}
    pdv_map: dict[int, PDV] = {}
    ct_map: dict[int, CrateType] = {}

    if pdv_ids:
        r = await db.execute(select(PDV).where(PDV.id.in_(pdv_ids)))
        pdv_map = {p.id: p for p in r.scalars().all()}
    if ct_ids:
        r = await db.execute(select(CrateType).where(CrateType.id.in_(ct_ids)))
        ct_map = {c.id: c for c in r.scalars().all()}

    return [
        {
            **{c.key: getattr(req, c.key) for c in CrateRequest.__table__.columns},
            "status": req.status.value if hasattr(req.status, 'value') else req.status,
            "pdv": {"id": pdv_map[req.pdv_id].id, "code": pdv_map[req.pdv_id].code, "name": pdv_map[req.pdv_id].name}
            if req.pdv_id in pdv_map else None,
            "crate_type": ct_map.get(req.crate_type_id),
        }
        for req in requests
    ]


@router.post("/", response_model=CrateRequestRead, status_code=201)
async def create_crate_request(
    data: CrateRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("crate-requests", "create")),
):
    """Creer une demande de casiers / Create a crate request."""
    # Forcer le PDV si utilisateur PDV
    forced_pdv = enforce_pdv_scope(user, data.pdv_id)
    if forced_pdv is not None:
        data.pdv_id = forced_pdv

    if not data.pdv_id:
        raise HTTPException(status_code=400, detail="PDV requis")

    # Valider PDV
    pdv = await db.get(PDV, data.pdv_id)
    if not pdv:
        raise HTTPException(status_code=404, detail="PDV not found")

    # Valider crate type
    ct = await db.get(CrateType, data.crate_type_id)
    if not ct:
        raise HTTPException(status_code=404, detail="Crate type not found")
    if not ct.is_active:
        raise HTTPException(status_code=400, detail="Ce type de casier n'est plus disponible")

    if data.quantity < 1 or data.quantity > 999:
        raise HTTPException(status_code=400, detail="Quantite invalide (1-999)")

    req = CrateRequest(
        pdv_id=data.pdv_id,
        crate_type_id=data.crate_type_id,
        quantity=data.quantity,
        status=CrateRequestStatus.REQUESTED,
        notes=data.notes,
        requested_at=_now_iso(),
        requested_by_user_id=user.id,
    )
    db.add(req)
    await db.flush()

    return {
        **{c.key: getattr(req, c.key) for c in CrateRequest.__table__.columns},
        "status": req.status.value,
        "pdv": {"id": pdv.id, "code": pdv.code, "name": pdv.name},
        "crate_type": ct,
    }


@router.put("/{request_id}/status")
async def update_crate_request_status(
    request_id: int,
    data: CrateRequestStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("crate-requests", "update")),
):
    """Changer le statut d'une demande / Update request status (service vidange)."""
    req = await db.get(CrateRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    new_status = CrateRequestStatus(data.status)
    now = _now_iso()

    # Valider la transition de statut
    valid_transitions = {
        CrateRequestStatus.REQUESTED: {CrateRequestStatus.ORDERED, CrateRequestStatus.CANCELLED},
        CrateRequestStatus.ORDERED: {CrateRequestStatus.DELIVERED, CrateRequestStatus.CANCELLED},
    }
    allowed = valid_transitions.get(req.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transition {req.status.value} → {new_status.value} non autorisee",
        )

    req.status = new_status
    if data.notes is not None:
        req.notes = data.notes

    if new_status == CrateRequestStatus.ORDERED:
        req.ordered_at = now
        req.ordered_by_user_id = user.id
    elif new_status == CrateRequestStatus.DELIVERED:
        req.delivered_at = now
        req.delivered_by_user_id = user.id

    await db.flush()

    return {"id": req.id, "status": req.status.value}


@router.delete("/{request_id}", status_code=204)
async def delete_crate_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("crate-requests", "delete")),
):
    """Supprimer une demande / Delete a request."""
    req = await db.get(CrateRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.delete(req)
