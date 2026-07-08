"""Gestion des politiques de rétention / Retention policy management (STIME A6).

Réservé aux superadmins : consultation et ajustement des durées de conservation.
Toute modification est journalisée à l'audit. La purge tourne quotidiennement
(app/services/retention.py) ; un déclenchement manuel est disponible pour test.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_superadmin
from app.database import get_db
from app.models.audit import AuditLog
from app.models.retention_policy import RetentionPolicy
from app.models.user import User
from app.services.retention import MIN_AUDIT_RETENTION_DAYS, run_retention_purge

router = APIRouter()


class RetentionPolicyRead(BaseModel):
    id: int
    category: str
    label: str
    retention_days: int
    legal_basis: str | None
    is_active: bool
    updated_at: str | None
    model_config = {"from_attributes": True}


class RetentionPolicyUpdate(BaseModel):
    retention_days: int = Field(ge=1, le=3650)
    is_active: bool | None = None


@router.get("/", response_model=list[RetentionPolicyRead])
async def list_policies(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_superadmin),
):
    """Lister les politiques de rétention / List retention policies."""
    result = await db.execute(select(RetentionPolicy).order_by(RetentionPolicy.category))
    return result.scalars().all()


@router.put("/{category}", response_model=RetentionPolicyRead)
async def update_policy(
    category: str,
    data: RetentionPolicyUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_superadmin),
):
    """Ajuster une durée de conservation / Adjust a retention duration."""
    result = await db.execute(select(RetentionPolicy).where(RetentionPolicy.category == category))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Catégorie de rétention inconnue")

    if category == "audit_logs" and data.retention_days < MIN_AUDIT_RETENTION_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Les journaux d'audit doivent être conservés au moins "
                   f"{MIN_AUDIT_RETENTION_DAYS} jours (exigence sécurité)",
        )

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    old_days = policy.retention_days
    policy.retention_days = data.retention_days
    if data.is_active is not None:
        policy.is_active = data.is_active
    policy.updated_at = now

    db.add(AuditLog(
        entity_type="retention", entity_id=policy.id, action="UPDATE",
        changes=f'{{"category":"{category}","retention_days":[{old_days},{data.retention_days}]}}',
        user=user.username, timestamp=now,
    ))
    await db.flush()
    await db.refresh(policy)
    return policy


@router.post("/purge")
async def trigger_purge(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_superadmin),
):
    """Déclencher une purge immédiate (test/exercice) / Trigger an immediate purge."""
    counts = await run_retention_purge(db)
    return {"detail": "Purge exécutée", "purged": counts}
