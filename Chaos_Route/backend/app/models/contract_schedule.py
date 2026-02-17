"""Modèle Planning contrat (date-par-date) / Contract schedule model (date-based)."""

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ContractSchedule(Base):
    """Exception de disponibilité par date / Date-based availability exception.

    Convention : par défaut un contrat est disponible tous les jours.
    On ne stocke que les dates d'exception (indisponibles).
    Convention: by default a contract is available every day.
    Only exception dates (unavailable) are stored.
    """
    __tablename__ = "contract_schedules"
    __table_args__ = (UniqueConstraint("contract_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    is_available: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relations
    contract: Mapped["Contract"] = relationship(back_populates="schedules")

    def __repr__(self) -> str:
        return f"<ContractSchedule contract={self.contract_id} date={self.date}>"
