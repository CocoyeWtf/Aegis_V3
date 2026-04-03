"""Modele regles support par base / Base-support rules model.
Definit quels types de support peuvent etre repris par quelle base.
Si pas de regle pour un couple base/support → autorise par defaut.
"""

from sqlalchemy import Boolean, ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BaseSupportRule(Base):
    """Regle d'acceptation d'un type de support par une base / Support type acceptance rule per base."""
    __tablename__ = "base_support_rules"
    __table_args__ = (
        Index("ix_base_support_rules_base_support", "base_id", "support_type_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    base_id: Mapped[int] = mapped_column(ForeignKey("bases_logistics.id"), nullable=False)
    support_type_id: Mapped[int] = mapped_column(ForeignKey("support_types.id"), nullable=False)
    allowed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relations
    base: Mapped["BaseLogistics"] = relationship()
    support_type: Mapped["SupportType"] = relationship()
