"""Modele type de casier commandable / Orderable crate type model.
Reference parametrable des casiers que les PDV peuvent commander a la base.
"""

import enum

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CrateType(Base):
    """Type de casier commandable par un PDV / Orderable crate type for PDVs."""
    __tablename__ = "crate_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    format: Mapped[str] = mapped_column(String(20), nullable=False)           # 25CL, 33CL, 75CL, 1L, FUT6L, OTHER
    brand: Mapped[str | None] = mapped_column(String(100))                    # Nullable pour casiers generiques
    sorting_rule: Mapped[str] = mapped_column(String(20), default="SPECIFIC") # SPECIFIC, FORMAT_MIX
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def __repr__(self) -> str:
        return f"<CrateType {self.code} - {self.name}>"
