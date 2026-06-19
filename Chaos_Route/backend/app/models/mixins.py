"""Mixins de modèles partagés / Shared model mixins.

TenantMixin : ajoute la clé de cloisonnement multi-société `tenant_id` à un modèle.
Le filtrage (lecture) et le stampage (écriture) sont appliqués **automatiquement et
centralement** dans app.database (events SQLAlchemy `do_orm_execute` / `before_flush`),
de sorte qu'aucun endpoint n'a à recopier le filtre — l'oubli devient impossible.

`tenant_id` est volontairement **nullable** à ce stade :
- migration sans douleur (l'auto-migration n'a pas à forcer de DEFAULT invalide) ;
- backfill `tenant_id=1` (Belgique) sur les lignes existantes au démarrage ;
- passage en NOT NULL + FK envisageable dans une phase ultérieure, une fois le
  backfill confirmé en production.
"""

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column


class TenantMixin:
    """Ajoute `tenant_id` (société propriétaire de la ligne) à un modèle d'exploitation."""

    tenant_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("tenants.id"),
        nullable=True,
        index=True,
    )
