"""Modèle Type de Support / Support Type model (palettes, CHEP, etc.)."""

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SupportType(Base):
    """Type de contenant réutilisable / Reusable container type (e.g. Palette Europe, CHEP)."""
    __tablename__ = "support_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # ex: 15 palettes par pile
    unit_label: Mapped[str | None] = mapped_column(String(100))  # ex: "pile de 15"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    image_path: Mapped[str | None] = mapped_column(String(255))
