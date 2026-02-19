"""Routes Historique / Audit log API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/")
async def list_audit_logs(
    entity_type: str | None = Query(default=None),
    entity_id: int | None = Query(default=None),
    action: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lister les logs d'audit (superadmin uniquement) / List audit logs (superadmin only)."""
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Superadmin only")
    query = select(AuditLog).order_by(AuditLog.id.desc())
    count_query = select(func.count(AuditLog.id))

    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
        count_query = count_query.where(AuditLog.entity_id == entity_id)
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)

    total = await db.scalar(count_query) or 0
    result = await db.execute(query.offset(offset).limit(limit))
    logs = result.scalars().all()

    return {
        "total": total,
        "items": [
            {
                "id": log.id,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "action": log.action,
                "changes": log.changes,
                "user": log.user,
                "timestamp": log.timestamp,
            }
            for log in logs
        ],
    }
