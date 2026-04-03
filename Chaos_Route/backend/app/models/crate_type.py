"""Modele type de casier commandable / Orderable crate type model.
Reference parametrable des casiers que les PDV peuvent commander a la base.
"""

import enum

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CrateFormat(str, enum.Enum):
    """Format de bouteille / Bottle format."""
    CL25 = "25CL"
    CL33 = "33CL"
    CL75 = "75CL"
    L1 = "1L"
    FUT6L = "FUT6L"
    OTHER = "OTHER"


class SortingRule(str, enum.Enum):
    """Regle de tri / Sorting rule."""
    SPECIFIC = "SPECIFIC"       # Tri par caisse specifique (pas de melange)
    FORMAT_MIX = "FORMAT_MIX"   # Melange tolere par format de bouteille


class CrateType(Base):
    """Type de casier commandable par un PDV / Orderable crate type for PDVs."""
    __tablename__ = "crate_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    format: Mapped[CrateFormat] = mapped_column(Enum(CrateFormat), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(100))  # Nullable pour casiers generiques
    sorting_rule: Mapped[SortingRule] = mapped_column(Enum(SortingRule), default=SortingRule.SPECIFIC)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def __repr__(self) -> str:
        return f"<CrateType {self.code} - {self.name}>"
