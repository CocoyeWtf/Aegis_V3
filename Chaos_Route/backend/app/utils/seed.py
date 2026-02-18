"""
Seed du superadmin / Superadmin seeding.
Crée le compte admin par défaut au premier démarrage si aucun utilisateur n'existe.
Creates default admin account on first startup if no users exist.
"""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.auth import hash_password


async def seed_superadmin(session: AsyncSession) -> None:
    """Créer le superadmin si aucun utilisateur n'existe / Create superadmin if no users exist."""
    result = await session.execute(select(func.count(User.id)))
    count = result.scalar()

    if count == 0:
        admin = User(
            username="admin",
            email="admin@chaos-route.app",
            hashed_password=hash_password("admin"),
            is_active=True,
            is_superadmin=True,
        )
        session.add(admin)
        await session.commit()
        print("[OK] Superadmin créé / Superadmin created: admin / admin")
    else:
        print(f"[OK] {count} utilisateur(s) existant(s), seed ignoré / {count} existing user(s), seed skipped")
