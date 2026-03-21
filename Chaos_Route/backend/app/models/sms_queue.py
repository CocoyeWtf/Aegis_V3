"""File d'attente SMS pour passerelle Termux / SMS queue for Termux gateway."""

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SmsQueue(Base):
    """Message SMS en attente d'envoi / SMS message pending send."""
    __tablename__ = "sms_queue"
    __table_args__ = (
        Index("ix_sms_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)       # +32xxx ou +33xxx
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(10), default="PENDING")   # PENDING, SENT, FAILED
    booking_id: Mapped[int | None] = mapped_column(Integer)              # Ref booking (optionnel)
    created_at: Mapped[str] = mapped_column(String(32), nullable=False)
    sent_at: Mapped[str | None] = mapped_column(String(32))
    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
