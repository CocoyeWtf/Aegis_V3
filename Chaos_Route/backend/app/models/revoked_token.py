"""Jetons révoqués / Revoked JWT tokens (STIME A4).

Liste noire par identifiant de jeton (jti) : un logout révoque réellement les
jetons côté serveur, et chaque refresh fait tourner (et révoque) l'ancien
refresh token. Les entrées expirées sont purgées par la tâche de rétention.
"""

from sqlalchemy import Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RevokedToken(Base):
    """Jeton révoqué (logout / rotation) / Revoked token (logout / rotation)."""

    __tablename__ = "revoked_tokens"
    __table_args__ = (
        Index("ix_revoked_tokens_jti", "jti", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    jti: Mapped[str] = mapped_column(String(32), nullable=False)
    token_type: Mapped[str] = mapped_column(String(10), nullable=False)  # access | refresh
    user_id: Mapped[int | None] = mapped_column(Integer)
    # Expiration du jeton révoqué (ISO 8601) : après cette date, l'entrée est
    # inutile (le jeton est expiré de toute façon) et purgée.
    expires_at: Mapped[str] = mapped_column(String(32), nullable=False)
    revoked_at: Mapped[str] = mapped_column(String(32), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(50))  # logout | rotation | admin
