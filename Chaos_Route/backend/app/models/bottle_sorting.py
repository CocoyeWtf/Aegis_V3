"""Tri vidanges bière / Beer bottle sorting.
Sessions de tri des retours par format et marque.
Sorting sessions for returned empties by size and brand.
"""

import enum

from sqlalchemy import Column, Enum, Float, Index, Integer, String, Text, ForeignKey
from app.database import Base


class SortingStatus(str, enum.Enum):
    """Statut de session / Session status."""
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class BottleFormat(str, enum.Enum):
    """Format bouteille / Bottle format."""
    CL_25 = "25CL"
    CL_33 = "33CL"
    CL_50 = "50CL"
    CL_75 = "75CL"


class SortingRule(str, enum.Enum):
    """Règle de tri / Sorting rule."""
    MONO = "MONO"          # Mono-marque strict (Chimay, Orval, etc.)
    MIX_ALLOWED = "MIX_ALLOWED"   # Mélange toléré entre marques spécifiques
    FORMAT_MIX = "FORMAT_MIX"     # Mélange par format dans casier générique


class BottleBrand(Base):
    """Marque/sous-type de bouteille pour le tri.
    Bottle brand/sub-type for sorting."""
    __tablename__ = "bottle_brands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    format = Column(Enum(BottleFormat), nullable=False)
    sorting_rule = Column(Enum(SortingRule), nullable=False, default=SortingRule.FORMAT_MIX)
    # Groupe de mélange toléré (ex: "CINEY_MORT_SUBITE")
    mix_group = Column(String(50), nullable=True)
    # Lien casier dédié si mono-marque
    crate_support_type_id = Column(Integer, ForeignKey("support_types.id"), nullable=True)
    bottles_per_crate = Column(Integer, nullable=False, default=24)
    deposit_per_bottle = Column(Float, nullable=True)  # EUR
    is_active = Column(Integer, nullable=False, default=1)


class SortingSession(Base):
    """Session de tri vidanges.
    Bottle sorting session."""
    __tablename__ = "sorting_sessions"
    __table_args__ = (
        Index("ix_sorting_session_date", "session_date"),
        Index("ix_sorting_session_base", "base_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    base_id = Column(Integer, ForeignKey("bases_logistics.id"), nullable=False)
    session_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    status = Column(Enum(SortingStatus), nullable=False, default=SortingStatus.IN_PROGRESS)
    operator_name = Column(String(100), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    started_at = Column(String(32), nullable=False)  # ISO 8601
    completed_at = Column(String(32), nullable=True)
    notes = Column(Text, nullable=True)
    # Totaux calculés à la complétion
    total_crates = Column(Integer, nullable=True)
    total_bottles = Column(Integer, nullable=True)


class SortingLine(Base):
    """Ligne de tri — comptage par marque/format.
    Sorting line — count by brand/format."""
    __tablename__ = "sorting_lines"
    __table_args__ = (
        Index("ix_sorting_line_session", "session_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sorting_sessions.id"), nullable=False)
    brand_id = Column(Integer, ForeignKey("bottle_brands.id"), nullable=True)
    # Pour les mélanges format, pas de brand_id — juste le format
    bottle_format = Column(Enum(BottleFormat), nullable=False)
    sorting_rule = Column(Enum(SortingRule), nullable=False)
    # Comptages
    full_crates = Column(Integer, nullable=False, default=0)  # Casiers complets
    loose_bottles = Column(Integer, nullable=False, default=0)  # Bouteilles hors casier
    damaged_bottles = Column(Integer, nullable=False, default=0)  # Bouteilles cassées
    # Label affiché (pour les lignes FORMAT_MIX : "Mélange 25CL")
    label = Column(String(200), nullable=True)
