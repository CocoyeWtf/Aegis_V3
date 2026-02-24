"""Ligne manifeste WMS — un support chargé / WMS manifest line — one loaded support."""

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TourManifestLine(Base):
    """Ligne manifeste WMS — un support chargé / WMS manifest line — one loaded support."""
    __tablename__ = "tour_manifest_lines"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), nullable=False)
    pdv_code: Mapped[str] = mapped_column(String(20), nullable=False)
    support_number: Mapped[str] = mapped_column(String(50), nullable=False)
    support_label: Mapped[str | None] = mapped_column(String(100))
    eqc: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    nb_colis: Mapped[int] = mapped_column(Integer, default=0)
    # Rempli au scan / Filled on scan
    scanned: Mapped[bool] = mapped_column(Boolean, default=False)
    scanned_at_stop_id: Mapped[int | None] = mapped_column(ForeignKey("tour_stops.id"))
    scanned_at: Mapped[str | None] = mapped_column(String(25))  # ISO 8601
