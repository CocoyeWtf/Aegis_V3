"""Modèle Arrêt de tournée / Tour stop model."""

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TourStop(Base):
    __tablename__ = "tour_stops"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), nullable=False)
    pdv_id: Mapped[int] = mapped_column(ForeignKey("pdvs.id"), nullable=False)
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False)
    eqp_count: Mapped[int] = mapped_column(Integer, nullable=False)
    arrival_time: Mapped[str | None] = mapped_column(String(5))  # HH:MM
    departure_time: Mapped[str | None] = mapped_column(String(5))  # HH:MM
    distance_from_previous_km: Mapped[float | None] = mapped_column(Numeric(10, 2))
    duration_from_previous_minutes: Mapped[int | None] = mapped_column(Integer)

    # Relations
    tour: Mapped["Tour"] = relationship(back_populates="stops")
    pdv: Mapped["PDV"] = relationship(back_populates="tour_stops")

    def __repr__(self) -> str:
        return f"<TourStop tour={self.tour_id} seq={self.sequence_order} pdv={self.pdv_id}>"
