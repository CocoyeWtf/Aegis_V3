"""
Seed du superadmin / Superadmin seeding.

Remédiation STIME A1 : plus de compte « admin/admin » par défaut.
- Le compte initial est créé uniquement si la base ne contient AUCUN utilisateur.
- Identifiants lus depuis l'environnement (ADMIN_USERNAME / ADMIN_PASSWORD).
- Base vide sans ADMIN_PASSWORD → refus de démarrer (RuntimeError explicite).
- Le mot de passe fourni doit satisfaire la politique renforcée (compte privilégié).
- Le compte est créé avec must_change_password=True : rotation forcée au 1er login.
- Le mot de passe n'est jamais journalisé.
"""

import logging

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.utils.auth import hash_password
from app.utils.password_policy import PasswordPolicyError, validate_password_strength

logger = logging.getLogger("chaos_route.seed")


async def seed_superadmin(session: AsyncSession) -> None:
    """Créer le superadmin initial si aucun utilisateur n'existe /
    Create initial superadmin if no users exist.

    Raises:
        RuntimeError: base vide et ADMIN_PASSWORD absent ou trop faible
            (l'application refuse de démarrer plutôt que de créer un compte faible).
    """
    result = await session.execute(select(func.count(User.id)))
    count = result.scalar()

    if count:
        logger.info("%s utilisateur(s) existant(s), seed superadmin ignoré", count)
        return

    if not settings.ADMIN_PASSWORD:
        raise RuntimeError(
            "Base utilisateurs vide et ADMIN_PASSWORD non défini. "
            "Refus de démarrer : définissez ADMIN_USERNAME / ADMIN_PASSWORD dans "
            "l'environnement (.env) pour créer le compte superadmin initial. "
            "Aucun compte par défaut n'est créé (exigence sécurité STIME A1)."
        )

    try:
        validate_password_strength(settings.ADMIN_PASSWORD, privileged=True)
    except PasswordPolicyError as exc:
        raise RuntimeError(
            f"ADMIN_PASSWORD refusé par la politique de mot de passe : {exc} "
            "Refus de démarrer avec un mot de passe superadmin faible."
        ) from exc

    admin = User(
        username=settings.ADMIN_USERNAME,
        email=settings.ADMIN_EMAIL,
        hashed_password=hash_password(settings.ADMIN_PASSWORD),
        is_active=True,
        is_superadmin=True,
        must_change_password=True,
    )
    session.add(admin)
    await session.commit()
    logger.info(
        "Superadmin initial créé : %s (changement de mot de passe forcé au 1er login)",
        settings.ADMIN_USERNAME,
    )
