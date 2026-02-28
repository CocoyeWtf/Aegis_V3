"""
Connexion a la base de donnees / Database connection.
Supporte SQLite (dev) et PostgreSQL (prod) via SQLAlchemy 2.0 async.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# Configuration moteur / Engine configuration
_engine_kwargs: dict = {
    "echo": settings.DEBUG,
}

# PostgreSQL : connection pooling pour 230 utilisateurs concurrents /
# PostgreSQL: connection pooling for 230 concurrent users (200 drivers + 30 office)
if not _is_sqlite:
    _engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 30,
        "pool_timeout": 30,
        "pool_recycle": 1800,
        "pool_pre_ping": True,
    })

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """Dependance FastAPI pour obtenir une session DB / FastAPI dependency for DB session."""
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
    """Creer les tables au demarrage / Create tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Ajouter les colonnes manquantes sur tables existantes /
    # Add missing columns on existing tables
    await _migrate_missing_columns()
    # Generer les QR/badge codes manquants / Backfill missing QR/badge codes
    await _backfill_qr_codes()
    # Purger les positions GPS > 30 jours / Purge GPS positions older than 30 days
    await _cleanup_old_gps()


async def _backfill_qr_codes():
    """Generer qr_code/badge_code pour les entites existantes / Backfill QR/badge codes for existing entities."""
    import uuid

    async with async_session() as session:
        # Vehicules sans qr_code / Vehicles without qr_code
        result = await session.execute(
            text("SELECT id FROM vehicles WHERE qr_code IS NULL OR qr_code = ''")
        )
        vehicle_ids = [row[0] for row in result.fetchall()]
        for vid in vehicle_ids:
            code = uuid.uuid4().hex[:8].upper()
            await session.execute(
                text("UPDATE vehicles SET qr_code = :code WHERE id = :id"),
                {"code": code, "id": vid},
            )
        if vehicle_ids:
            print(f"[backfill] Generated qr_code for {len(vehicle_ids)} vehicles")

        # Users sans badge_code / Users without badge_code
        result = await session.execute(
            text("SELECT id FROM users WHERE badge_code IS NULL OR badge_code = ''")
        )
        user_ids = [row[0] for row in result.fetchall()]
        for uid in user_ids:
            code = uuid.uuid4().hex[:8].upper()
            await session.execute(
                text("UPDATE users SET badge_code = :code WHERE id = :id"),
                {"code": code, "id": uid},
            )
        if user_ids:
            print(f"[backfill] Generated badge_code for {len(user_ids)} users")

        await session.commit()


async def _cleanup_old_gps(days: int = 30):
    """Purger les positions GPS des tours > 30 jours / Purge GPS positions for tours older than 30 days."""
    from datetime import datetime, timedelta
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    async with engine.begin() as conn:
        result = await conn.execute(text(
            "DELETE FROM gps_positions WHERE tour_id IN "
            "(SELECT id FROM tours WHERE date < :cutoff)"
        ), {"cutoff": cutoff})
        if result.rowcount:
            print(f"[cleanup] {result.rowcount} GPS positions removed (tours before {cutoff})")


async def _migrate_missing_columns():
    """Verifier et ajouter les colonnes manquantes / Check and add missing columns via ALTER TABLE.

    Supporte SQLite (PRAGMA) et PostgreSQL (information_schema).
    """
    async with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            # Detecter les colonnes existantes / Detect existing columns
            if _is_sqlite:
                result = await conn.execute(text(f"PRAGMA table_info('{table.name}')"))
                existing_cols = {row[1] for row in result.fetchall()}
            else:
                result = await conn.execute(text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = :table_name AND table_schema = 'public'"
                ), {"table_name": table.name})
                existing_cols = {row[0] for row in result.fetchall()}

            for col in table.columns:
                if col.name not in existing_cols:
                    col_type = col.type.compile(dialect=engine.dialect)
                    col_type_str = str(col_type)

                    # Determiner la valeur par defaut / Determine default value
                    if col_type_str == "BOOLEAN":
                        default = "DEFAULT FALSE" if not _is_sqlite else "DEFAULT 0"
                    elif col_type_str.startswith("VARCHAR") or col_type_str == "TEXT":
                        default = "DEFAULT ''"
                    elif col_type_str in ("INTEGER", "BIGINT"):
                        default = "DEFAULT 0"
                    elif col_type_str.startswith("NUMERIC") or col_type_str.startswith("FLOAT"):
                        default = "DEFAULT 0"
                    else:
                        default = ""

                    await conn.execute(text(
                        f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col_type} {default}'
                    ))
                    print(f"[migrate] Added column {table.name}.{col.name} ({col_type})")
