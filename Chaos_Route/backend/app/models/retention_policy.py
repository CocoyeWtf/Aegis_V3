"""Politique de rétention des données / Data retention policy (STIME A6).

Table centrale des durées de conservation (registre Art. 30 RGPD). Chaque
catégorie de données a une durée définie ; la purge automatique quotidienne
(app/services/retention.py) s'aligne sur ces valeurs.
"""

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RetentionPolicy(Base):
    """Durée de conservation d'une catégorie de données / Retention duration.

    Table plateforme (non cloisonnée par tenant) : la politique de rétention
    est globale et documentée au registre des traitements.
    """

    __tablename__ = "retention_policies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Catégorie technique (clé du purgeur) / Technical category (purger key)
    category: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    retention_days: Mapped[int] = mapped_column(Integer, nullable=False)
    # Base légale / justification (registre Art. 30)
    legal_basis: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[str | None] = mapped_column(String(32))  # ISO 8601

    def __repr__(self) -> str:
        return f"<RetentionPolicy {self.category}={self.retention_days}j>"
