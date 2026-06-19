"""Modèle Tenant / Tenant model.

Un tenant = une société cliente (multi-tenance). La Belgique = tenant id=1.
Les données d'exploitation portent un tenant_id (voir app.models.mixins.TenantMixin) ;
les référentiels universels (types de bacs, matrices km/taxe, prix carburant…) restent
partagés entre tous les tenants.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Identifiant du tenant par défaut (Belgique) — utilisé pour le backfill et le
# stampage des lignes existantes / Default tenant id (Belgium).
DEFAULT_TENANT_ID = 1


class Tenant(Base):
    """Société cliente isolée logiquement / Logically isolated client company."""

    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    def __repr__(self) -> str:
        return f"<Tenant {self.code} - {self.name}>"
