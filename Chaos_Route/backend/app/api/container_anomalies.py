"""Routes API anomalies contenants — kanban / Container anomaly API — kanban workflow."""

import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.container_anomaly import (
    ContainerAnomaly, AnomalyPhoto, AnomalyComment,
    AnomalyStatus, AnomalyCategory, AnomalySeverity,
)
from app.models.pdv import PDV
from app.models.base_logistics import BaseLogistics
from app.models.support_type import SupportType
from app.models.user import User
from app.schemas.container_anomaly import (
    AnomalyCreate, AnomalyUpdate, AnomalyDetail,
    AnomalyCommentCreate, AnomalyCommentRead, AnomalyKanbanBoard,
)
from app.api.deps import require_permission, get_current_user

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "anomalies")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _enum_val(v: object) -> str:
    return v.value if hasattr(v, 'value') else str(v)


def _compute_delay(created_at: str | None, status: str) -> float | None:
    if not created_at or status not in ("OPEN", "IN_PROGRESS"):
        return None
    try:
        created = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        return round((datetime.now(timezone.utc) - created).total_seconds() / 3600, 1)
    except Exception:
        return None


async def _enrich_batch(anomalies: list[ContainerAnomaly], db: AsyncSession) -> list[AnomalyDetail]:
    """Enrichit un lot d'anomalies en 5 queries (pas N×7).
    Batch-enrich anomalies in 5 queries instead of N×7."""
    if not anomalies:
        return []

    ids = [a.id for a in anomalies]

    # 1. Bulk load PDVs
    pdv_ids = {a.pdv_id for a in anomalies if a.pdv_id}
    pdv_map: dict[int, PDV] = {}
    if pdv_ids:
        pdv_map = {p.id: p for p in (await db.execute(select(PDV).where(PDV.id.in_(pdv_ids)))).scalars()}

    # 2. Bulk load Bases
    base_ids = {a.base_id for a in anomalies if a.base_id}
    base_map: dict[int, BaseLogistics] = {}
    if base_ids:
        base_map = {b.id: b for b in (await db.execute(select(BaseLogistics).where(BaseLogistics.id.in_(base_ids)))).scalars()}

    # 3. Bulk load SupportTypes
    st_ids = {a.support_type_id for a in anomalies if a.support_type_id}
    st_map: dict[int, SupportType] = {}
    if st_ids:
        st_map = {s.id: s for s in (await db.execute(select(SupportType).where(SupportType.id.in_(st_ids)))).scalars()}

    # 4. Bulk load Users (created_by + assigned_to)
    user_ids = {a.created_by for a in anomalies if a.created_by} | {a.assigned_to for a in anomalies if a.assigned_to}
    user_map: dict[int, User] = {}
    if user_ids:
        user_map = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars()}

    # 5. Bulk counts photos + comments (2 aggregate queries)
    photo_counts: dict[int, int] = {}
    comment_counts: dict[int, int] = {}
    if ids:
        pc = await db.execute(
            select(AnomalyPhoto.anomaly_id, func.count()).where(AnomalyPhoto.anomaly_id.in_(ids)).group_by(AnomalyPhoto.anomaly_id)
        )
        photo_counts = dict(pc.all())
        cc = await db.execute(
            select(AnomalyComment.anomaly_id, func.count()).where(AnomalyComment.anomaly_id.in_(ids)).group_by(AnomalyComment.anomaly_id)
        )
        comment_counts = dict(cc.all())

    # Build results
    details = []
    for a in anomalies:
        pdv = pdv_map.get(a.pdv_id) if a.pdv_id else None
        base = base_map.get(a.base_id) if a.base_id else None
        st = st_map.get(a.support_type_id) if a.support_type_id else None
        created_user = user_map.get(a.created_by) if a.created_by else None
        assigned_user = user_map.get(a.assigned_to) if a.assigned_to else None
        status_val = _enum_val(a.status)

        details.append(AnomalyDetail(
            id=a.id,
            pdv_id=a.pdv_id, pdv_code=pdv.code if pdv else None, pdv_name=pdv.name if pdv else None,
            base_id=a.base_id, base_name=base.name if base else None,
            support_type_id=a.support_type_id, support_type_code=st.code if st else None, support_type_name=st.name if st else None,
            category=_enum_val(a.category), severity=_enum_val(a.severity), status=status_val,
            title=a.title, description=a.description,
            quantity_expected=a.quantity_expected, quantity_actual=a.quantity_actual,
            financial_impact=a.financial_impact, reference=a.reference,
            created_at=a.created_at, created_by=a.created_by,
            created_by_name=created_user.username if created_user else None,
            assigned_to=a.assigned_to, assigned_to_name=assigned_user.username if assigned_user else None,
            started_at=a.started_at, resolved_at=a.resolved_at,
            resolved_by=a.resolved_by, resolution_notes=a.resolution_notes,
            due_date=a.due_date, delay_hours=_compute_delay(a.created_at, status_val),
            photo_count=photo_counts.get(a.id, 0), comment_count=comment_counts.get(a.id, 0),
        ))
    return details


# ─── Board kanban / Kanban board ────────────────────────────────────────


@router.get("/board/", dependencies=[Depends(require_permission("container-anomalies", "read"))])
async def kanban_board(
    category: str | None = Query(None),
    severity: str | None = Query(None),
    pdv_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> AnomalyKanbanBoard:
    """Retourne le board kanban avec les 3 colonnes / Returns kanban board with 3 columns."""
    q = select(ContainerAnomaly).where(ContainerAnomaly.status != AnomalyStatus.CLOSED)
    if category:
        q = q.where(ContainerAnomaly.category == category)
    if severity:
        q = q.where(ContainerAnomaly.severity == severity)
    if pdv_id:
        q = q.where(ContainerAnomaly.pdv_id == pdv_id)
    q = q.order_by(
        case(
            (ContainerAnomaly.severity == AnomalySeverity.CRITICAL, 0),
            (ContainerAnomaly.severity == AnomalySeverity.HIGH, 1),
            (ContainerAnomaly.severity == AnomalySeverity.MEDIUM, 2),
            else_=3,
        ),
        ContainerAnomaly.created_at.desc(),
    ).limit(500)

    result = await db.execute(q)
    anomalies = result.scalars().all()

    # Batch enrichment : 6 queries au lieu de 7×N
    all_details = await _enrich_batch(anomalies, db)

    open_items = []
    in_progress_items = []
    resolved_items = []

    for detail in all_details:
        if detail.status == "OPEN":
            open_items.append(detail)
        elif detail.status == "IN_PROGRESS":
            in_progress_items.append(detail)
        elif detail.status == "RESOLVED":
            resolved_items.append(detail)

    # Stats rapides
    stats_q = select(
        func.count().label("total"),
        func.sum(case((ContainerAnomaly.status == AnomalyStatus.OPEN, 1), else_=0)).label("open"),
        func.sum(case((ContainerAnomaly.severity == AnomalySeverity.CRITICAL, 1), else_=0)).label("critical"),
        func.sum(func.coalesce(ContainerAnomaly.financial_impact, 0)).label("total_impact"),
    ).where(ContainerAnomaly.status != AnomalyStatus.CLOSED)
    stats_row = (await db.execute(stats_q)).one()

    return AnomalyKanbanBoard(
        open=open_items,
        in_progress=in_progress_items,
        resolved=resolved_items,
        stats={
            "total": stats_row.total or 0,
            "open": stats_row.open or 0,
            "critical": stats_row.critical or 0,
            "total_impact": round(float(stats_row.total_impact or 0), 2),
        },
    )


# ─── CRUD anomalies ────────────────────────────────────────────────────


@router.post("/", dependencies=[Depends(require_permission("container-anomalies", "create"))])
async def create_anomaly(
    data: AnomalyCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Crée une anomalie / Create an anomaly."""
    a = ContainerAnomaly(
        pdv_id=data.pdv_id,
        base_id=data.base_id,
        support_type_id=data.support_type_id,
        category=AnomalyCategory(data.category),
        severity=AnomalySeverity(data.severity),
        status=AnomalyStatus.OPEN,
        title=data.title,
        description=data.description,
        quantity_expected=data.quantity_expected,
        quantity_actual=data.quantity_actual,
        financial_impact=data.financial_impact,
        reference=data.reference,
        created_at=_now_iso(),
        created_by=user.id if user else None,
        assigned_to=data.assigned_to,
        due_date=data.due_date,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return (await _enrich_batch([a], db))[0]


@router.put("/{anomaly_id}", dependencies=[Depends(require_permission("container-anomalies", "update"))])
async def update_anomaly(
    anomaly_id: int,
    data: AnomalyUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Met à jour une anomalie (statut, assignation, résolution).
    Update an anomaly (status, assignment, resolution)."""
    a = await db.get(ContainerAnomaly, anomaly_id)
    if not a:
        raise HTTPException(404, "Anomalie introuvable")

    now = _now_iso()

    if data.status:
        new_status = AnomalyStatus(data.status)
        old_status = a.status.value if hasattr(a.status, 'value') else a.status
        if new_status.value == "IN_PROGRESS" and old_status == "OPEN":
            a.started_at = now
        elif new_status.value == "RESOLVED" and old_status != "RESOLVED":
            a.resolved_at = now
            a.resolved_by = user.id if user else None
        a.status = new_status

    if data.severity:
        a.severity = AnomalySeverity(data.severity)
    if data.title is not None:
        a.title = data.title
    if data.description is not None:
        a.description = data.description
    if data.assigned_to is not None:
        a.assigned_to = data.assigned_to
    if data.resolution_notes is not None:
        a.resolution_notes = data.resolution_notes
    if data.due_date is not None:
        a.due_date = data.due_date
    if data.financial_impact is not None:
        a.financial_impact = data.financial_impact

    await db.commit()
    await db.refresh(a)
    return (await _enrich_batch([a], db))[0]


@router.delete("/{anomaly_id}", dependencies=[Depends(require_permission("container-anomalies", "delete"))])
async def delete_anomaly(anomaly_id: int, db: AsyncSession = Depends(get_db)):
    """Supprime une anomalie / Delete an anomaly."""
    a = await db.get(ContainerAnomaly, anomaly_id)
    if not a:
        raise HTTPException(404, "Anomalie introuvable")
    # Supprimer photos et commentaires associés
    await db.execute(select(AnomalyPhoto).where(AnomalyPhoto.anomaly_id == anomaly_id))
    photos = (await db.execute(select(AnomalyPhoto).where(AnomalyPhoto.anomaly_id == anomaly_id))).scalars().all()
    for p in photos:
        await db.delete(p)
    comments = (await db.execute(select(AnomalyComment).where(AnomalyComment.anomaly_id == anomaly_id))).scalars().all()
    for c in comments:
        await db.delete(c)
    await db.delete(a)
    await db.commit()
    return {"message": "Anomalie supprimee"}


# ─── Photos ─────────────────────────────────────────────────────────────


@router.post("/{anomaly_id}/photos/", dependencies=[Depends(require_permission("container-anomalies", "update"))])
async def upload_photo(
    anomaly_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload une photo pour une anomalie / Upload a photo for an anomaly."""
    a = await db.get(ContainerAnomaly, anomaly_id)
    if not a:
        raise HTTPException(404, "Anomalie introuvable")

    # Validation MIME type (images uniquement)
    ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Type de fichier non autorise: {file.content_type}. Seuls JPEG/PNG/WebP/GIF acceptes.")

    content = await file.read()

    # Limite de taille : 5 Mo
    if len(content) > 5_000_000:
        raise HTTPException(413, "Fichier trop volumineux (max 5 Mo)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    # Extension safe : basée sur le MIME, pas sur le nom de fichier utilisateur
    MIME_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    ext = MIME_EXT.get(file.content_type, ".jpg")
    unique_name = f"{anomaly_id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    # Protection path traversal
    resolved = os.path.realpath(file_path)
    if not resolved.startswith(os.path.realpath(UPLOAD_DIR)):
        raise HTTPException(400, "Chemin de fichier invalide")

    with open(file_path, "wb") as f:
        f.write(content)

    photo = AnomalyPhoto(
        anomaly_id=anomaly_id,
        filename=file.filename or unique_name,
        file_path=f"/uploads/anomalies/{unique_name}",
        file_size=len(content),
        mime_type=file.content_type,
        uploaded_at=_now_iso(),
    )
    db.add(photo)
    await db.commit()
    return {"id": photo.id, "file_path": photo.file_path}


@router.get("/{anomaly_id}/photos/", dependencies=[Depends(require_permission("container-anomalies", "read"))])
async def list_photos(anomaly_id: int, db: AsyncSession = Depends(get_db)):
    """Liste les photos d'une anomalie / List anomaly photos."""
    q = select(AnomalyPhoto).where(AnomalyPhoto.anomaly_id == anomaly_id).order_by(AnomalyPhoto.uploaded_at)
    result = await db.execute(q)
    return [{"id": p.id, "filename": p.filename, "file_path": p.file_path, "uploaded_at": p.uploaded_at} for p in result.scalars().all()]


# ─── Commentaires / Comments ────────────────────────────────────────────


@router.post("/{anomaly_id}/comments/", dependencies=[Depends(require_permission("container-anomalies", "update"))])
async def add_comment(
    anomaly_id: int,
    data: AnomalyCommentCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Ajoute un commentaire / Add a comment."""
    a = await db.get(ContainerAnomaly, anomaly_id)
    if not a:
        raise HTTPException(404, "Anomalie introuvable")

    comment = AnomalyComment(
        anomaly_id=anomaly_id,
        user_id=user.id if user else None,
        content=data.content,
        created_at=_now_iso(),
    )
    db.add(comment)
    await db.commit()
    return {"id": comment.id}


@router.get("/{anomaly_id}/comments/", dependencies=[Depends(require_permission("container-anomalies", "read"))])
async def list_comments(anomaly_id: int, db: AsyncSession = Depends(get_db)):
    """Liste les commentaires d'une anomalie / List anomaly comments."""
    q = (
        select(AnomalyComment, User)
        .outerjoin(User, AnomalyComment.user_id == User.id)
        .where(AnomalyComment.anomaly_id == anomaly_id)
        .order_by(AnomalyComment.created_at)
    )
    result = await db.execute(q)
    return [
        AnomalyCommentRead(
            id=c.id, anomaly_id=c.anomaly_id, user_id=c.user_id,
            user_name=u.username if u else None,
            content=c.content, created_at=c.created_at,
        )
        for c, u in result.all()
    ]
