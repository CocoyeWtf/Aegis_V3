"""Routes Surcharges Tour / Tour Surcharges API routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.audit import AuditLog
from app.models.surcharge_type import SurchargeType
from app.models.tour_surcharge import TourSurcharge, SurchargeStatus
from app.models.user import User
from app.schemas.surcharge import SurchargeCreate, SurchargeDelete, SurchargeRead, SurchargeValidate
from app.api.deps import require_permission
from app.utils.auth import verify_password

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _surcharge_to_read(s: TourSurcharge) -> SurchargeRead:
    """Convertir un modèle en schema de lecture / Convert model to read schema."""
    st_label = ""
    if s.surcharge_type:
        st_label = s.surcharge_type.label
    return SurchargeRead(
        id=s.id,
        tour_id=s.tour_id,
        amount=float(s.amount),
        surcharge_type_id=s.surcharge_type_id,
        surcharge_type_label=st_label,
        comment=s.comment,
        motif=s.motif or "",
        status=s.status.value if hasattr(s.status, "value") else s.status,
        created_by_id=s.created_by_id,
        created_at=s.created_at,
        validated_by_id=s.validated_by_id,
        validated_at=s.validated_at,
        created_by_username=s.created_by.username if s.created_by else "",
        validated_by_username=s.validated_by.username if s.validated_by else None,
    )


@router.get("/by-tour/{tour_id}", response_model=list[SurchargeRead])
async def list_surcharges_by_tour(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("surcharges", "read")),
):
    """Liste les surcharges d'un tour / List surcharges for a tour."""
    result = await db.execute(
        select(TourSurcharge)
        .where(TourSurcharge.tour_id == tour_id)
        .order_by(TourSurcharge.created_at.desc())
    )
    surcharges = result.scalars().all()
    # Eager-load relations
    for s in surcharges:
        await db.refresh(s, ["created_by", "validated_by", "surcharge_type"])
    return [_surcharge_to_read(s) for s in surcharges]


@router.post("/", response_model=SurchargeRead, status_code=201)
async def create_surcharge(
    payload: SurchargeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("surcharges", "create")),
):
    """Créer une surcharge PENDING / Create a PENDING surcharge."""
    # Valider que le type existe / Validate type exists
    st = await db.get(SurchargeType, payload.surcharge_type_id)
    if not st:
        raise HTTPException(status_code=400, detail="Type de surcharge invalide")

    surcharge = TourSurcharge(
        tour_id=payload.tour_id,
        amount=payload.amount,
        surcharge_type_id=payload.surcharge_type_id,
        comment=payload.comment,
        motif=st.label,  # legacy field: store label for backwards compat
        status=SurchargeStatus.PENDING,
        created_by_id=user.id,
        created_at=_now_iso(),
    )
    db.add(surcharge)

    db.add(AuditLog(
        entity_type="TourSurcharge",
        entity_id=0,
        action="CREATE",
        changes=f"tour_id={payload.tour_id} amount={payload.amount} type={st.code} comment={payload.comment or ''}",
        user=user.username,
        timestamp=_now_iso(),
    ))

    await db.commit()
    await db.refresh(surcharge, ["created_by", "validated_by", "surcharge_type"])
    return _surcharge_to_read(surcharge)


@router.post("/{surcharge_id}/validate", response_model=SurchargeRead)
async def validate_surcharge(
    surcharge_id: int,
    payload: SurchargeValidate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("surcharges", "update")),
):
    """Valider une surcharge (vérification mdp) / Validate a surcharge (password check)."""
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=403, detail="Mot de passe incorrect")

    result = await db.execute(select(TourSurcharge).where(TourSurcharge.id == surcharge_id))
    surcharge = result.scalar_one_or_none()
    if not surcharge:
        raise HTTPException(status_code=404, detail="Surcharge non trouvée")
    if surcharge.status == SurchargeStatus.VALIDATED:
        raise HTTPException(status_code=400, detail="Surcharge déjà validée")

    surcharge.status = SurchargeStatus.VALIDATED
    surcharge.validated_by_id = user.id
    surcharge.validated_at = _now_iso()

    db.add(AuditLog(
        entity_type="TourSurcharge",
        entity_id=surcharge.id,
        action="VALIDATE",
        changes=f"validated_by={user.username}",
        user=user.username,
        timestamp=_now_iso(),
    ))

    await db.commit()
    await db.refresh(surcharge, ["created_by", "validated_by", "surcharge_type"])
    return _surcharge_to_read(surcharge)


@router.delete("/{surcharge_id}", status_code=204)
async def delete_surcharge(
    surcharge_id: int,
    payload: SurchargeDelete,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("surcharges", "delete")),
):
    """Supprimer une surcharge (vérification mdp) / Delete a surcharge (password check)."""
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=403, detail="Mot de passe incorrect")

    result = await db.execute(select(TourSurcharge).where(TourSurcharge.id == surcharge_id))
    surcharge = result.scalar_one_or_none()
    if not surcharge:
        raise HTTPException(status_code=404, detail="Surcharge non trouvée")

    db.add(AuditLog(
        entity_type="TourSurcharge",
        entity_id=surcharge.id,
        action="DELETE",
        changes=f"amount={float(surcharge.amount)} motif={surcharge.motif} status={surcharge.status}",
        user=user.username,
        timestamp=_now_iso(),
    ))

    await db.delete(surcharge)
    await db.commit()
