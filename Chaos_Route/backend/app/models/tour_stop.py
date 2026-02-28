"""Modèle Arrêt de tournée / Tour stop model."""

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
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
    pickup_cardboard: Mapped[bool] = mapped_column(Boolean, default=False)
    pickup_containers: Mapped[bool] = mapped_column(Boolean, default=False)
    pickup_returns: Mapped[bool] = mapped_column(Boolean, default=False)
    pickup_consignment: Mapped[bool] = mapped_column(Boolean, default=False)

    # Champs suivi livraison mobile / Mobile delivery tracking fields
    delivery_status: Mapped[str | None] = mapped_column(String(20))  # PENDING | ARRIVED | DELIVERED | SKIPPED
    actual_arrival_time: Mapped[str | None] = mapped_column(String(32))  # ISO 8601
    actual_departure_time: Mapped[str | None] = mapped_column(String(32))  # ISO 8601
    missing_supports_count: Mapped[int | None] = mapped_column(Integer, default=0)
    forced_closure: Mapped[bool] = mapped_column(Boolean, default=False)
    delivery_notes: Mapped[str | None] = mapped_column(Text)

    # Relations
    tour: Mapped["Tour"] = relationship(back_populates="stops")
    pdv: Mapped["PDV"] = relationship(back_populates="tour_stops")

    def __repr__(self) -> str:
        return f"<TourStop tour={self.tour_id} seq={self.sequence_order} pdv={self.pdv_id}>"
