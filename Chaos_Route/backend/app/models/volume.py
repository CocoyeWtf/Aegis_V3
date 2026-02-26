"""Modèle Volume / Volume model (commandes PDV)."""

import enum

from sqlalchemy import Date, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TemperatureClass(str, enum.Enum):
    """Classe de température / Temperature class."""
    SEC = "SEC"
    FRAIS = "FRAIS"
    GEL = "GEL"


class Volume(Base):
    __tablename__ = "volumes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pdv_id: Mapped[int] = mapped_column(ForeignKey("pdvs.id"), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    nb_colis: Mapped[int | None] = mapped_column(Integer, nullable=True)
    eqp_count: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(10, 2))
    temperature_class: Mapped[TemperatureClass] = mapped_column(Enum(TemperatureClass), nullable=False)
    base_origin_id: Mapped[int] = mapped_column(ForeignKey("bases_logistics.id"), nullable=False)
    preparation_start: Mapped[str | None] = mapped_column(String(16))  # YYYY-MM-DDTHH:MM
    preparation_end: Mapped[str | None] = mapped_column(String(16))  # YYYY-MM-DDTHH:MM
    dispatch_date: Mapped[str | None] = mapped_column(String(10))   # YYYY-MM-DD — date de répartition
    dispatch_time: Mapped[str | None] = mapped_column(String(5))    # HH:MM — heure de répartition
    tour_id: Mapped[int | None] = mapped_column(ForeignKey("tours.id", ondelete="SET NULL"), nullable=True)

    # Volume total en m3 et nombre de supports/palettes (import SUPERLOG)
    # Total volume in m3 and number of supports/pallets (SUPERLOG import)
    volume_m3: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    nb_supports: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Activité : suivi (fond de rayon) ou mise en avant (promo) / Activity type
    activity_type: Mapped[str | None] = mapped_column(String(10))  # 'SUIVI' | 'MEAV'
    # Date début promo (MEAV uniquement) / Promo start date (MEAV only)
    promo_start_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD
    # Groupe de split — volumes issus du même original / Split group — volumes from same original
    split_group_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relations
    pdv: Mapped["PDV"] = relationship(back_populates="volumes")
    base_origin: Mapped["BaseLogistics"] = relationship()
    tour: Mapped["Tour | None"] = relationship()

    def __repr__(self) -> str:
        return f"<Volume pdv={self.pdv_id} date={self.date} eqp={self.eqp_count}>"
