"""
Connexion à la base de données / Database connection.
Supporte SQLite (dev) et PostgreSQL (prod) via SQLAlchemy 2.0 async.
"""

from sqlalchemy import text
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
    # Ajouter les colonnes manquantes sur tables existantes (SQLite) /
    # Add missing columns on existing tables (SQLite dev)
    await _migrate_missing_columns()


async def _migrate_missing_columns():
    """Vérifier et ajouter les colonnes manquantes / Check and add missing columns via ALTER TABLE."""
    async with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            result = await conn.execute(text(f"PRAGMA table_info('{table.name}')"))
            existing_cols = {row[1] for row in result.fetchall()}
            for col in table.columns:
                if col.name not in existing_cols:
                    col_type = col.type.compile(dialect=engine.dialect)
                    default = "DEFAULT 0" if str(col_type) == "BOOLEAN" else ""
                    await conn.execute(text(
                        f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type} {default}"
                    ))
