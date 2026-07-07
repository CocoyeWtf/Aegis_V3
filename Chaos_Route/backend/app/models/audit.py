"""Modèle Historique / Audit log model."""

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TenantMixin


class AuditLog(Base, TenantMixin):
    """Journal d'audit, cloisonné par tenant : chaque entrée est stampée avec le
    tenant de l'acteur (session), et la lecture est filtrée automatiquement.
    Un compte consolidation/superadmin (tenant None) voit tout. /
    Tenant-scoped audit log (auto-stamped + auto-filtered)."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # CREATE, UPDATE, DELETE
    changes: Mapped[str | None] = mapped_column(Text)  # JSON des changements
    user: Mapped[str | None] = mapped_column(String(100))
    timestamp: Mapped[str] = mapped_column(String(32), nullable=False)  # ISO 8601

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.entity_type}:{self.entity_id}>"
