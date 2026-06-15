"""Routes Tickets / Ticket board API.

Board TRANSPARENT : tout utilisateur authentifié voit tous les tickets et tous
les échanges. Chaque action (création, commentaire, changement de statut) est
horodatée et attribuée → traçabilité complète (litige, bilan annuel).
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_permission
from app.database import get_db
from app.models.ticket import Ticket, TicketComment, TicketStatus, TicketType, TicketPriority
from app.models.user import User
from app.schemas.ticket import (
    TicketCommentCreate, TicketCommentRead, TicketCreate, TicketDetail,
    TicketListItem, TicketStatusUpdate,
)

router = APIRouter()


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
    query = (
        select(Ticket, func.coalesce(count_sq.c.cnt, 0))
        .outerjoin(count_sq, count_sq.c.ticket_id == Ticket.id)
        .order_by(Ticket.created_at.desc())
    )
    if status is not None:
        query = query.where(Ticket.status == status)
    if ticket_type is not None:
        query = query.where(Ticket.ticket_type == ticket_type)

    result = await db.execute(query)
    items: list[TicketListItem] = []
    for ticket, cnt in result.all():
        item = TicketListItem.model_validate(ticket)
        item.comment_count = int(cnt or 0)
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
        select(Ticket).where(Ticket.id == ticket_id).options(selectinload(Ticket.comments))
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
        select(Ticket).where(Ticket.id == ticket.id).options(selectinload(Ticket.comments))
    )
    return result.scalar_one()


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
        select(Ticket).where(Ticket.id == ticket.id).options(selectinload(Ticket.comments))
    )
    return result.scalar_one()
