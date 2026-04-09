"""Routes Alertes Operationnelles / Operational Alert API routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.operational_alert import (
    AlertComment, AlertPriority, AlertStatus, AlertType, OperationalAlert,
)
from app.models.user import User
from app.schemas.operational_alert import AlertCommentCreate, AlertCommentRead, AlertCreate, AlertRead
from app.api.deps import require_permission

router = APIRouter()


@router.get("/", response_model=list[AlertRead])
async def list_alerts(
    status: str | None = None,
    base_id: int | None = None,
    date: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("operations", "read")),
):
    """Lister les alertes / List alerts."""
    query = (
        select(OperationalAlert)
        .options(selectinload(OperationalAlert.comments))
        .order_by(OperationalAlert.created_at.desc())
        .limit(limit)
    )
    if status:
        query = query.where(OperationalAlert.status == AlertStatus(status))
    if base_id:
        query = query.where(OperationalAlert.base_id == base_id)
    if date:
        query = query.where(OperationalAlert.date == date)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/pending-count")
async def pending_count(
    base_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("operations", "read")),
):
    """Nombre d'alertes en attente / Pending alert count."""
    from sqlalchemy import func
    query = select(func.count(OperationalAlert.id)).where(
        OperationalAlert.status == AlertStatus.PENDING
    )
    if base_id:
        query = query.where(OperationalAlert.base_id == base_id)
    result = await db.execute(query)
    return {"count": result.scalar() or 0}


@router.post("/", response_model=AlertRead, status_code=201)
async def create_alert(
    data: AlertCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("operations", "update")),
):
    """Creer une alerte manuelle / Create manual alert."""
    alert = OperationalAlert(
        alert_type=AlertType(data.alert_type),
        priority=AlertPriority(data.priority),
        title=data.title,
        message=data.message,
        tour_id=data.tour_id,
        tour_code=data.tour_code,
        pdv_id=data.pdv_id,
        pdv_code=data.pdv_code,
        base_id=data.base_id,
        date=data.date,
        created_by_user_id=user.id,
        created_by_name=f"{user.first_name} {user.last_name}".strip() or user.username,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert, ["comments"])
    return alert


@router.put("/{alert_id}/acknowledge", response_model=AlertRead)
async def acknowledge_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("operations", "update")),
):
    """Accuser reception / Acknowledge alert."""
    alert = await db.get(OperationalAlert, alert_id, options=[selectinload(OperationalAlert.comments)])
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.status = AlertStatus.ACKNOWLEDGED
    await db.flush()
    return alert


@router.put("/{alert_id}/resolve", response_model=AlertRead)
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("operations", "update")),
):
    """Resoudre / Resolve alert."""
    alert = await db.get(OperationalAlert, alert_id, options=[selectinload(OperationalAlert.comments)])
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.status = AlertStatus.RESOLVED
    alert.resolved_by_user_id = user.id
    alert.resolved_by_name = f"{user.first_name} {user.last_name}".strip() or user.username
    alert.resolved_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    await db.flush()
    return alert


@router.post("/{alert_id}/comments", response_model=AlertCommentRead, status_code=201)
async def add_comment(
    alert_id: int,
    data: AlertCommentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("operations", "update")),
):
    """Ajouter un commentaire / Add comment."""
    alert = await db.get(OperationalAlert, alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    comment = AlertComment(
        alert_id=alert_id,
        user_id=user.id,
        user_name=f"{user.first_name} {user.last_name}".strip() or user.username,
        text=data.text,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return comment


# ── Helper pour créer des alertes depuis d'autres endpoints ──

async def create_system_alert(
    db: AsyncSession,
    alert_type: AlertType,
    title: str,
    message: str,
    user: User,
    priority: AlertPriority = AlertPriority.MEDIUM,
    tour_id: int | None = None,
    tour_code: str | None = None,
    pdv_id: int | None = None,
    pdv_code: str | None = None,
    base_id: int | None = None,
    date: str | None = None,
    freed_eqp: float | None = None,
    extra_data: str | None = None,
) -> OperationalAlert:
    """Creer une alerte systeme (appelable depuis d'autres modules) / Create system alert."""
    alert = OperationalAlert(
        alert_type=alert_type,
        priority=priority,
        status=AlertStatus.PENDING,
        title=title,
        message=message,
        tour_id=tour_id,
        tour_code=tour_code,
        pdv_id=pdv_id,
        pdv_code=pdv_code,
        base_id=base_id,
        date=date,
        freed_eqp=freed_eqp,
        extra_data=extra_data,
        created_by_user_id=user.id,
        created_by_name=f"{user.first_name} {user.last_name}".strip() or user.username,
    )
    db.add(alert)
    return alert
