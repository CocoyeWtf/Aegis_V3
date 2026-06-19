"""Modèle Ticket / Support ticket model.

Board de tickets TRANSPARENT (type « Issue Council ») : tout utilisateur
authentifié voit tous les tickets et tous les échanges. Traçabilité complète
(chaque action horodatée + attribuée) pour litige et bilan annuel.
Transparent ticket board: every authenticated user sees all tickets and
exchanges. Full audit trail for disputes and yearly reporting.
"""

import enum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TenantMixin


class TicketType(str, enum.Enum):
    """Type de ticket / Ticket type."""
    BUG = "BUG"                  # Dysfonctionnement
    FEATURE = "FEATURE"          # Demande d'évolution
    QUESTION = "QUESTION"        # Question / assistance
    OTHER = "OTHER"


class TicketStatus(str, enum.Enum):
    """Statut du ticket / Ticket status."""
    OPEN = "OPEN"                      # Nouveau / à traiter
    ACKNOWLEDGED = "ACKNOWLEDGED"      # Pris en compte / en analyse
    IN_PROGRESS = "IN_PROGRESS"        # En cours
    RESOLVED = "RESOLVED"             # Résolu (à confirmer)
    CLOSED = "CLOSED"                 # Clôturé
    REJECTED = "REJECTED"            # Refusé / non retenu


class TicketPriority(str, enum.Enum):
    """Priorité / Priority."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Ticket(Base, TenantMixin):
    """Ticket de support / évolution. / Support / feature ticket."""
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Classification
    ticket_type: Mapped[TicketType] = mapped_column(Enum(TicketType, name="ticket_type"), default=TicketType.BUG)
    status: Mapped[TicketStatus] = mapped_column(Enum(TicketStatus, name="ticket_status"), default=TicketStatus.OPEN)
    priority: Mapped[TicketPriority] = mapped_column(Enum(TicketPriority, name="ticket_priority"), default=TicketPriority.MEDIUM)

    # Contenu / Content
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Contexte capturé automatiquement (JSON sérialisé) : route, version app,
    # navigateur/OS, fil d'Ariane des dernières actions, périmètre, erreurs console.
    # Auto-captured context (serialized JSON) for understanding the issue.
    context: Mapped[str | None] = mapped_column(Text)

    # Auteur / Author
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_by_name: Mapped[str | None] = mapped_column(String(150))
    created_at: Mapped[str | None] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[str | None] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relations
    comments: Mapped[list["TicketComment"]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan",
        order_by="TicketComment.created_at",
    )

    def __repr__(self) -> str:
        return f"<Ticket #{self.id} [{self.ticket_type.value}] {self.status.value}>"


class TicketComment(Base, TenantMixin):
    """Échange / événement sur un ticket. is_system=True pour les changements de
    statut (trace). / Comment or system event (status change) on a ticket."""
    __tablename__ = "ticket_comments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    user_name: Mapped[str | None] = mapped_column(String(150))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # Événement système (changement de statut/priorité) vs message humain
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str | None] = mapped_column(DateTime, server_default=func.now())

    ticket: Mapped["Ticket"] = relationship(back_populates="comments")
