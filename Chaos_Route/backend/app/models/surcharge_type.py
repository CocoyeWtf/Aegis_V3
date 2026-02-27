"""Modèle Type de Surcharge / Surcharge Type model (Heures sup, Casse, etc.)."""

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SurchargeType(Base):
    """Type de surcharge / Surcharge type (e.g. Heures sup, Casse, Pénalité retard)."""
    __tablename__ = "surcharge_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
