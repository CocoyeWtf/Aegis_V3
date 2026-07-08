"""Révocation de jetons JWT / JWT token revocation (STIME A4).

Un logout (ou une rotation de refresh token) inscrit le jti du jeton dans la
liste noire `revoked_tokens` ; toute utilisation ultérieure est refusée.
Les entrées expirées sont purgées par la tâche de rétention quotidienne.
"""

from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.revoked_token import RevokedToken


def _exp_to_iso(payload: dict) -> str:
    exp = payload.get("exp")
    if isinstance(exp, (int, float)):
        return datetime.fromtimestamp(exp, tz=timezone.utc).isoformat(timespec="seconds")
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def revoke_token(session: AsyncSession, payload: dict, reason: str) -> None:
    """Révoquer un jeton décodé (no-op sans jti — vieux jetons pré-A4) /
    Revoke a decoded token (no-op without jti — pre-A4 legacy tokens)."""
    jti = payload.get("jti")
    if not jti or await is_revoked(session, jti):
        return
    session.add(RevokedToken(
        jti=jti,
        token_type=str(payload.get("type", "")),
        user_id=int(payload["sub"]) if payload.get("sub") else None,
        expires_at=_exp_to_iso(payload),
        revoked_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        reason=reason,
    ))
    await session.flush()


async def is_revoked(session: AsyncSession, jti: str | None) -> bool:
    """Le jti est-il en liste noire ? / Is the jti blacklisted?"""
    if not jti:
        # Jetons émis avant A4 (sans jti) : non révocables individuellement,
        # ils expirent naturellement (access 30 min, refresh 7 j).
        return False
    result = await session.execute(
        select(RevokedToken.id).where(RevokedToken.jti == jti).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def purge_expired_revocations(session: AsyncSession) -> int:
    """Supprimer les entrées dont le jeton est expiré / Drop entries for expired tokens."""
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    result = await session.execute(delete(RevokedToken).where(RevokedToken.expires_at < now))
    return result.rowcount or 0
