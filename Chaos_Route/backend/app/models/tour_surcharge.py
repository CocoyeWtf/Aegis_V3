"""Modèle Surcharge Tour / Tour Surcharge model."""

import enum

from sqlalchemy import Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SurchargeStatus(str, enum.Enum):
    """Statut de la surcharge / Surcharge status."""
    PENDING = "PENDING"
    VALIDATED = "VALIDATED"


class TourSurcharge(Base):
    __tablename__ = "tour_surcharges"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    motif: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[SurchargeStatus] = mapped_column(Enum(SurchargeStatus), default=SurchargeStatus.PENDING)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[str] = mapped_column(String(25), nullable=False)  # ISO 8601
    validated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    validated_at: Mapped[str | None] = mapped_column(String(25), nullable=True)

    # Relations
    tour: Mapped["Tour"] = relationship(back_populates="surcharges")
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
    validated_by: Mapped["User | None"] = relationship(foreign_keys=[validated_by_id])

    def __repr__(self) -> str:
        return f"<TourSurcharge {self.id} tour={self.tour_id} {self.amount}€ {self.status}>"
