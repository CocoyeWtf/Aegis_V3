"""Modele Zone de base logistique / Base logistics zone model."""

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BaseZone(Base):
    """Zone dans une base logistique / Zone within a logistics base."""
    __tablename__ = "base_zones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    base_id: Mapped[int] = mapped_column(ForeignKey("bases_logistics.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
