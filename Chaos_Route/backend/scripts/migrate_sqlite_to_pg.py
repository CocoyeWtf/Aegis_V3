"""
Migration SQLite -> PostgreSQL / SQLite to PostgreSQL data migration.

Usage:
    cd backend
    SQLITE_URL=sqlite+aiosqlite:///./data/chaos_route.db \
    DATABASE_URL=postgresql+asyncpg://cmro:password@db:5432/cmro \
    python -m scripts.migrate_sqlite_to_pg

Ou via Docker:
    docker compose run --rm \
      -e SQLITE_URL=sqlite+aiosqlite:///./data/chaos_route.db \
      app python -m scripts.migrate_sqlite_to_pg
"""

import asyncio
import os
import sys
from datetime import datetime, date

from sqlalchemy import text, DateTime, Date, Boolean
from sqlalchemy.ext.asyncio import create_async_engine

# Rendre le package app importable / Make app package importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base
from app.models import *  # noqa: F401, F403 — enregistrer tous les modeles


async def migrate():
    sqlite_url = os.getenv("SQLITE_URL", "sqlite+aiosqlite:///./data/chaos_route.db")
    pg_url = os.getenv("DATABASE_URL")

    if not pg_url or "postgresql" not in pg_url:
        print("ERREUR: DATABASE_URL doit etre une URL PostgreSQL")
        print("  Ex: DATABASE_URL=postgresql+asyncpg://cmro:password@db:5432/cmro")
        sys.exit(1)

    # Masquer le mot de passe dans les logs / Mask password in logs
    pg_display = pg_url.split("@")[-1] if "@" in pg_url else pg_url
    print(f"[migrate] Source SQLite : {sqlite_url}")
    print(f"[migrate] Cible PostgreSQL : ...@{pg_display}")

    sqlite_engine = create_async_engine(sqlite_url)
    pg_engine = create_async_engine(pg_url, pool_size=5)

    # Creer le schema dans PostgreSQL / Create schema in PostgreSQL
    print("[migrate] Creation du schema PostgreSQL...")
    async with pg_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[migrate] Schema cree")

    # Ordre d'insertion respectant les FK / FK-safe insertion order
    table_names = [t.name for t in Base.metadata.sorted_tables]
    print(f"[migrate] {len(table_names)} tables a migrer")

    total_rows = 0

    async with sqlite_engine.connect() as sqlite_conn:
        # Lister les tables existantes dans SQLite / List existing SQLite tables
        sqlite_tables_result = await sqlite_conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table'")
        )
        sqlite_existing = {row[0] for row in sqlite_tables_result.fetchall()}

        async with pg_engine.begin() as pg_conn:
            # Desactiver les FK checks pendant l'import / Disable FK checks during import
            await pg_conn.execute(text("SET session_replication_role = 'replica'"))

            for table_name in table_names:
                table = Base.metadata.tables[table_name]

                # Sauter les tables absentes de SQLite / Skip tables not in SQLite
                if table_name not in sqlite_existing:
                    print(f"  [skip] {table_name}: n'existe pas dans SQLite")
                    continue

                # Colonnes existantes dans SQLite / Existing columns in SQLite
                col_info = await sqlite_conn.execute(
                    text(f"PRAGMA table_info('{table_name}')")
                )
                sqlite_cols = {row[1] for row in col_info.fetchall()}
                model_cols = [c.name for c in table.columns]
                # Intersection ordonnee / Ordered intersection
                common_cols = [c for c in model_cols if c in sqlite_cols]

                if not common_cols:
                    print(f"  [skip] {table_name}: pas de colonnes communes")
                    continue

                # Lire les colonnes communes depuis SQLite / Read common columns from SQLite
                col_list = ", ".join(f'"{c}"' for c in common_cols)
                result = await sqlite_conn.execute(
                    text(f'SELECT {col_list} FROM "{table_name}"')
                )
                rows = result.fetchall()

                if not rows:
                    print(f"  [skip] {table_name}: 0 lignes")
                    continue

                # Detecter les colonnes qui necessitent une conversion de type /
                # Detect columns needing type conversion
                datetime_cols = set()
                date_cols = set()
                bool_cols = set()
                for col_name in common_cols:
                    if col_name in [c.name for c in table.columns]:
                        col_type = table.columns[col_name].type
                        if isinstance(col_type, DateTime):
                            datetime_cols.add(col_name)
                        elif isinstance(col_type, Date):
                            date_cols.add(col_name)
                        elif isinstance(col_type, Boolean):
                            bool_cols.add(col_name)

                # Inserer par batch dans PostgreSQL / Batch insert into PostgreSQL
                batch_size = 500
                col_names = ", ".join(f'"{c}"' for c in common_cols)
                placeholders = ", ".join(f":{c}" for c in common_cols)
                insert_sql = text(
                    f'INSERT INTO "{table_name}" ({col_names}) VALUES ({placeholders})'
                )

                for i in range(0, len(rows), batch_size):
                    batch = rows[i:i + batch_size]
                    for row in batch:
                        row_dict = dict(zip(common_cols, row))
                        # Convertir les types pour asyncpg / Convert types for asyncpg
                        for col_name, value in row_dict.items():
                            if value is None:
                                continue
                            if col_name in datetime_cols and isinstance(value, str):
                                try:
                                    row_dict[col_name] = datetime.fromisoformat(value)
                                except ValueError:
                                    pass
                            elif col_name in date_cols and isinstance(value, str):
                                try:
                                    row_dict[col_name] = date.fromisoformat(value)
                                except ValueError:
                                    pass
                            elif col_name in bool_cols and isinstance(value, int):
                                row_dict[col_name] = bool(value)
                        await pg_conn.execute(insert_sql, row_dict)

                total_rows += len(rows)
                print(f"  [OK] {table_name}: {len(rows)} lignes")

            # Reactiver les FK checks / Re-enable FK checks
            await pg_conn.execute(text("SET session_replication_role = 'origin'"))

    # Remettre a zero les sequences PostgreSQL (compteurs autoincrement) /
    # Reset PostgreSQL sequences (autoincrement counters)
    print("[migrate] Reset des sequences...")
    for table_name in table_names:
        table = Base.metadata.tables[table_name]
        # Seules les colonnes PK avec un seul champ autoincrement /
        # Only single-column PK with autoincrement
        pk_cols = [c for c in table.columns if c.primary_key and c.autoincrement]
        if len(table.primary_key.columns) > 1:
            continue  # Junction table, pas de sequence
        for pk_col in pk_cols:
            seq_name = f"{table_name}_{pk_col.name}_seq"
            try:
                async with pg_engine.begin() as pg_conn:
                    await pg_conn.execute(text(
                        f"SELECT setval('{seq_name}', "
                        f"COALESCE((SELECT MAX(\"{pk_col.name}\") FROM \"{table_name}\"), 0) + 1, false)"
                    ))
            except Exception:
                pass  # Table vide ou pas de sequence

    print(f"[migrate] Sequences resetees")

    await sqlite_engine.dispose()
    await pg_engine.dispose()

    print(f"\n{'=' * 50}")
    print(f"Migration terminee ! {total_rows} lignes migrees.")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    asyncio.run(migrate())
