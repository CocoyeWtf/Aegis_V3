"""
Connexion à la base de données / Database connection.
Supporte SQLite (dev) et PostgreSQL (prod) via SQLAlchemy 2.0 async.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """Dépendance FastAPI pour obtenir une session DB / FastAPI dependency for DB session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Créer les tables au démarrage (dev uniquement) / Create tables on startup (dev only)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
