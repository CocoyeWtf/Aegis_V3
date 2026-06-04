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
    await _migrate_enum_values()
    await _migrate_missing_columns()
    # Aligner les types de colonnes critiques sur les modèles /
    # Align critical column types with models
    await _migrate_column_types()
    # Ajouter les indexes manquants sur tables existantes /
    # Add missing indexes on existing tables
    await _migrate_missing_indexes()
    # Ajouter les contraintes FK manquantes (PG uniquement) /
    # Add missing FK constraints (PG only)
    await _migrate_missing_foreign_keys()
    # Generer les QR/badge codes manquants / Backfill missing QR/badge codes
    await _backfill_qr_codes()
    # Marquer le support combi (code CO) si pas encore fait /
    # Mark combi support type (code CO) if not yet flagged
    await _backfill_combi_support_type()
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


async def _backfill_combi_support_type():
    """Marquer le SupportType code='CO' comme is_combi=True s'il ne l'est pas /
    Mark SupportType with code='CO' as is_combi=True if not already.

    Idempotent : ne fait rien si deja flagge.
    Si le code 'CO' n'existe pas encore en DB, ne fait rien (silencieux).
    """
    async with async_session() as session:
        result = await session.execute(
            text("SELECT id, is_combi FROM support_types WHERE code = 'CO'")
        )
        row = result.fetchone()
        if row and not row[1]:
            await session.execute(
                text("UPDATE support_types SET is_combi = 1 WHERE id = :id"),
                {"id": row[0]},
            )
            await session.commit()
            print(f"[backfill] Flagged support_type id={row[0]} (code=CO) as is_combi")


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


async def _migrate_enum_values():
    """Ajouter les nouvelles valeurs aux types enum PostgreSQL / Add new enum values to PostgreSQL enum types."""
    if _is_sqlite:
        return
    enum_updates = [
        ("bookingstatus", ["UNLOADING", "DOCK_LEFT"]),
        ("dockeventtype", ["UNLOADING", "DOCK_LEFT", "SITE_LEFT"]),
        ("pickupstatus", ["CANCELLED"]),  # Annulation declaration combi remplacee
    ]
    async with engine.begin() as conn:
        for enum_name, new_values in enum_updates:
            # Lire les valeurs existantes / Read existing values
            result = await conn.execute(text(
                "SELECT enumlabel FROM pg_enum WHERE enumtypid = "
                "(SELECT oid FROM pg_type WHERE typname = :enum_name)"
            ), {"enum_name": enum_name})
            existing = {row[0] for row in result.fetchall()}
            for val in new_values:
                if val not in existing:
                    await conn.execute(text(
                        f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{val}'"
                    ))
                    print(f"[migrate] Added enum value {enum_name}.{val}")


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


async def _migrate_column_types():
    """Aligner les types de colonnes specifiques avec le modele SQLAlchemy
    pour les cas ou un ALTER TYPE est requis (SQLAlchemy create_all ne modifie
    pas les colonnes existantes).

    Liste des conversions sures (pas de perte) :
    - volumes.eqp_count : integer -> numeric(10,2)
    - tour_stops.eqp_count : integer -> numeric(10,2)

    PostgreSQL uniquement. SQLite est typage faible et tolere les decimaux dans
    une colonne integer.
    """
    if _is_sqlite:
        return

    targets = [
        ("volumes", "eqp_count", "numeric(10,2)"),
        ("tour_stops", "eqp_count", "numeric(10,2)"),
    ]

    async with engine.begin() as conn:
        for table, column, target_type in targets:
            try:
                result = await conn.execute(text(
                    "SELECT data_type FROM information_schema.columns "
                    "WHERE table_name = :t AND column_name = :c AND table_schema = 'public'"
                ), {"t": table, "c": column})
                row = result.fetchone()
                if not row:
                    continue
                current = row[0]
                # Si deja en numeric, rien a faire / Already numeric, skip
                if "numeric" in current.lower() or "double" in current.lower():
                    continue
                await conn.execute(text(
                    f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE {target_type} '
                    f'USING "{column}"::{target_type}'
                ))
                print(f"[migrate] Changed {table}.{column} type: {current} -> {target_type}")
            except Exception as e:
                print(f"[migrate] WARN: failed to alter {table}.{column}: {e}")


async def _migrate_missing_indexes():
    """Creer les indexes definis dans les modeles mais absents en DB /
    Create indexes defined in models but missing in DB.

    Compare Base.metadata.tables vs indexes existants en DB et cree ceux manquants.
    Idempotent : utilise CREATE INDEX IF NOT EXISTS.
    """
    async with engine.begin() as conn:
        # Lister les indexes existants en DB / List existing indexes in DB
        if _is_sqlite:
            result = await conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
            ))
            existing_indexes = {row[0] for row in result.fetchall()}
        else:
            result = await conn.execute(text(
                "SELECT indexname FROM pg_indexes WHERE schemaname='public'"
            ))
            existing_indexes = {row[0] for row in result.fetchall()}

        # Pour chaque index defini dans les modeles, le creer s'il manque /
        # For each model-defined index, create if missing
        for table in Base.metadata.sorted_tables:
            for index in table.indexes:
                if index.name and index.name not in existing_indexes:
                    cols = ", ".join(f'"{c.name}"' for c in index.columns)
                    unique = "UNIQUE " if index.unique else ""
                    try:
                        await conn.execute(text(
                            f'CREATE {unique}INDEX IF NOT EXISTS "{index.name}" '
                            f'ON "{table.name}" ({cols})'
                        ))
                        print(f"[migrate] Added index {index.name} on {table.name}({cols})")
                    except Exception as e:
                        # Ne pas bloquer le demarrage si un index pose probleme /
                        # Don't block startup on index issue
                        print(f"[migrate] WARN: failed to create index {index.name}: {e}")


async def _migrate_missing_foreign_keys():
    """Ajouter les contraintes FK definies dans les modeles mais absentes en DB /
    Add FK constraints defined in models but missing in DB.

    PostgreSQL uniquement : SQLite ne supporte pas ALTER TABLE ADD CONSTRAINT.
    En SQLite (dev), les FK sont creees a la creation de la table par create_all,
    et l'absence de FK sur colonnes ajoutees a posteriori est acceptee (FK pas
    enforcees par defaut).
    """
    if _is_sqlite:
        return

    async with engine.begin() as conn:
        # Lister les FK existantes / List existing FK constraints
        result = await conn.execute(text("""
            SELECT tc.table_name, kcu.column_name, tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
        """))
        # Set of (table_name, column_name) qui ont deja une FK /
        # (table_name, column_name) tuples that already have a FK
        existing_fks = {(row[0], row[1]) for row in result.fetchall()}

        for table in Base.metadata.sorted_tables:
            for col in table.columns:
                for fk in col.foreign_keys:
                    if (table.name, col.name) in existing_fks:
                        continue
                    target_table = fk.column.table.name
                    target_col = fk.column.name
                    on_delete = fk.ondelete or "NO ACTION"
                    constraint_name = f"fk_{table.name}_{col.name}"
                    try:
                        await conn.execute(text(
                            f'ALTER TABLE "{table.name}" '
                            f'ADD CONSTRAINT "{constraint_name}" '
                            f'FOREIGN KEY ("{col.name}") '
                            f'REFERENCES "{target_table}" ("{target_col}") '
                            f'ON DELETE {on_delete}'
                        ))
                        print(
                            f"[migrate] Added FK {constraint_name}: "
                            f"{table.name}.{col.name} -> {target_table}.{target_col} "
                            f"(ON DELETE {on_delete})"
                        )
                    except Exception as e:
                        # Ne pas bloquer si la contrainte existe deja sous un autre nom /
                        # Don't block if constraint exists under a different name
                        print(
                            f"[migrate] WARN: failed to add FK on "
                            f"{table.name}.{col.name}: {e}"
                        )
