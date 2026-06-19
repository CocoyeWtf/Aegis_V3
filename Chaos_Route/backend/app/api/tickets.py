"""Routes Tickets / Ticket board API.

Board TRANSPARENT : tout utilisateur authentifié voit tous les tickets et tous
les échanges. Chaque action (création, commentaire, changement de statut) est
horodatée et attribuée → traçabilité complète (litige, bilan annuel).
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_permission
from app.database import get_db
from app.models.ticket import Ticket, TicketComment, TicketPhoto, TicketStatus, TicketType, TicketPriority
from app.models.user import User
from app.schemas.ticket import (
    TicketCommentCreate, TicketCommentRead, TicketCreate, TicketDetail,
    TicketListItem, TicketPhotoRead, TicketStatusUpdate,
)

router = APIRouter()

# Stockage des photos de tickets (capture/illustration) / Ticket photo storage
TICKET_PHOTOS_DIR = Path("data/photos/tickets")
MAX_PHOTOS_PER_TICKET = 5
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB


def _user_name(user: User) -> str:
    return getattr(user, "full_name", None) or user.username


@router.get("/", response_model=list[TicketListItem])
async def list_tickets(
    status: TicketStatus | None = Query(None),
    ticket_type: TicketType | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lister TOUS les tickets (transparent) avec nb d'échanges / List all tickets."""
    count_sq = (
        select(TicketComment.ticket_id, func.count(TicketComment.id).label("cnt"))
        .group_by(TicketComment.ticket_id)
        .subquery()
    )
    photo_sq = (
        select(TicketPhoto.ticket_id, func.count(TicketPhoto.id).label("pcnt"))
        .group_by(TicketPhoto.ticket_id)
        .subquery()
    )
    query = (
        select(Ticket, func.coalesce(count_sq.c.cnt, 0), func.coalesce(photo_sq.c.pcnt, 0))
        .outerjoin(count_sq, count_sq.c.ticket_id == Ticket.id)
        .outerjoin(photo_sq, photo_sq.c.ticket_id == Ticket.id)
        .order_by(Ticket.created_at.desc())
    )
    if status is not None:
        query = query.where(Ticket.status == status)
    if ticket_type is not None:
        query = query.where(Ticket.ticket_type == ticket_type)

    result = await db.execute(query)
    items: list[TicketListItem] = []
    for ticket, cnt, pcnt in result.all():
        item = TicketListItem.model_validate(ticket)
        item.comment_count = int(cnt or 0)
        item.photo_count = int(pcnt or 0)
        items.append(item)
    return items


@router.get("/{ticket_id}", response_model=TicketDetail)
async def get_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Détail d'un ticket + tous les échanges (visible par tous) / Ticket detail."""
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id).options(
            selectinload(Ticket.comments), selectinload(Ticket.photos)
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.post("/", response_model=TicketDetail, status_code=201)
async def create_ticket(
    data: TicketCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Créer un ticket (avec contexte capturé) / Create a ticket with captured context."""
    ticket = Ticket(
        ticket_type=data.ticket_type,
        priority=data.priority,
        status=TicketStatus.OPEN,
        title=data.title,
        description=data.description,
        context=json.dumps(data.context, ensure_ascii=False) if data.context else None,
        created_by_user_id=user.id,
        created_by_name=_user_name(user),
    )
    db.add(ticket)
    await db.flush()
    # Événement système d'ouverture (trace) / Opening system event (trace)
    db.add(TicketComment(
        ticket_id=ticket.id, user_id=user.id, user_name=_user_name(user),
        body=f"Ticket ouvert par {_user_name(user)}.", is_system=True,
    ))
    await db.flush()
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket.id).options(
            selectinload(Ticket.comments), selectinload(Ticket.photos)
        )
    )
    return result.scalar_one()


# ─── Photos / captures d'écran jointes au ticket / Ticket photos ───

@router.post("/{ticket_id}/photos", response_model=TicketPhotoRead, status_code=201)
async def upload_ticket_photo(
    ticket_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Joindre une photo / capture d'écran à un ticket (illustre le problème).

    Ouvert à tout utilisateur authentifié, comme la création de ticket et les
    échanges (board transparent). Image uniquement, 5 Mo max, 5 photos max.
    """
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    result = await db.execute(
        select(func.count(TicketPhoto.id)).where(TicketPhoto.ticket_id == ticket_id)
    )
    if (result.scalar() or 0) >= MAX_PHOTOS_PER_TICKET:
        raise HTTPException(status_code=400, detail=f"Max {MAX_PHOTOS_PER_TICKET} photos par ticket")

    content = await file.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail="Photo trop volumineuse (max 5 Mo)")

    mime = file.content_type or "image/jpeg"
    if not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="Seules les images sont acceptées")

    # Nom de fichier sûr (UUID) — aucune entrée utilisateur dans le chemin /
    # Safe UUID filename — no user input in the path (anti path-traversal)
    ext = mime.split("/")[-1].replace("jpeg", "jpg").replace("svg+xml", "svg")
    unique_name = f"{uuid.uuid4().hex[:12]}.{ext}"
    photo_dir = TICKET_PHOTOS_DIR / str(ticket_id)
    photo_dir.mkdir(parents=True, exist_ok=True)
    file_path = photo_dir / unique_name
    file_path.write_bytes(content)

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    photo = TicketPhoto(
        ticket_id=ticket_id,
        filename=file.filename or unique_name,
        file_path=str(file_path),
        file_size=len(content),
        mime_type=mime,
        uploaded_at=now,
    )
    db.add(photo)
    # Trace : photo jointe (événement système) / system event for the audit trail
    db.add(TicketComment(
        ticket_id=ticket_id, user_id=user.id, user_name=_user_name(user),
        body=f"{_user_name(user)} a joint une photo.", is_system=True,
    ))
    await db.flush()
    await db.refresh(photo)
    return photo


@router.get("/{ticket_id}/photos/{photo_id}")
async def download_ticket_photo(
    ticket_id: int,
    photo_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Télécharger / afficher une photo de ticket / Download a ticket photo."""
    photo = await db.get(TicketPhoto, photo_id)
    if not photo or photo.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Photo not found")
    if not Path(photo.file_path).is_file():
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    return FileResponse(
        photo.file_path,
        media_type=photo.mime_type or "image/jpeg",
        filename=photo.filename,
    )


@router.post("/{ticket_id}/comments", response_model=TicketCommentRead, status_code=201)
async def add_comment(
    ticket_id: int,
    data: TicketCommentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Ajouter un échange (visible par tous) / Add an exchange (visible to all)."""
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not data.body.strip():
        raise HTTPException(status_code=422, detail="Message vide")
    comment = TicketComment(
        ticket_id=ticket_id, user_id=user.id, user_name=_user_name(user),
        body=data.body.strip(), is_system=False,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return comment


@router.put("/{ticket_id}/status", response_model=TicketDetail)
async def update_status(
    ticket_id: int,
    data: TicketStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tickets", "update")),
):
    """Changer statut/priorité — RÉSERVÉ admin (tickets:update ; superadmin inclus).
    Tracé comme événement système. / Status/priority change restricted to admins."""
    # Charger SANS les commentaires (sinon la collection en cache ne refléterait
    # pas l'événement système ajouté ci-dessous au moment du rechargement). /
    # Load without comments so the freshly-added system event is visible on reload.
    ticket = await db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    changes: list[str] = []
    if data.status is not None and data.status != ticket.status:
        changes.append(f"statut : {ticket.status.value} → {data.status.value}")
        ticket.status = data.status
    if data.priority is not None and data.priority != ticket.priority:
        changes.append(f"priorité : {ticket.priority.value} → {data.priority.value}")
        ticket.priority = data.priority

    if changes:
        db.add(TicketComment(
            ticket_id=ticket.id, user_id=user.id, user_name=_user_name(user),
            body=f"{_user_name(user)} a modifié le {' ; '.join(changes)}.", is_system=True,
        ))
    await db.flush()
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket.id).options(
            selectinload(Ticket.comments), selectinload(Ticket.photos)
        )
    )
    return result.scalar_one()
