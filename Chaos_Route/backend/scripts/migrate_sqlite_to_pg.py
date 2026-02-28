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

from sqlalchemy import text
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
        async with pg_engine.begin() as pg_conn:
            # Desactiver les FK checks pendant l'import / Disable FK checks during import
            await pg_conn.execute(text("SET session_replication_role = 'replica'"))

            for table_name in table_names:
                table = Base.metadata.tables[table_name]

                # Lire toutes les lignes SQLite / Read all SQLite rows
                result = await sqlite_conn.execute(table.select())
                rows = result.fetchall()

                if not rows:
                    print(f"  [skip] {table_name}: 0 lignes")
                    continue

                # Inserer par batch dans PostgreSQL / Batch insert into PostgreSQL
                columns = [c.name for c in table.columns]
                batch_size = 500

                for i in range(0, len(rows), batch_size):
                    batch = rows[i:i + batch_size]
                    values = [dict(zip(columns, row)) for row in batch]
                    await pg_conn.execute(table.insert(), values)

                total_rows += len(rows)
                print(f"  [OK] {table_name}: {len(rows)} lignes")

            # Reactiver les FK checks / Re-enable FK checks
            await pg_conn.execute(text("SET session_replication_role = 'origin'"))

    # Remettre a zero les sequences PostgreSQL (compteurs autoincrement) /
    # Reset PostgreSQL sequences (autoincrement counters)
    print("[migrate] Reset des sequences...")
    async with pg_engine.begin() as pg_conn:
        for table_name in table_names:
            table = Base.metadata.tables[table_name]
            pk_cols = [c for c in table.columns if c.primary_key and c.autoincrement]
            for pk_col in pk_cols:
                seq_name = f"{table_name}_{pk_col.name}_seq"
                try:
                    await pg_conn.execute(text(
                        f"SELECT setval('{seq_name}', "
                        f"COALESCE((SELECT MAX(\"{pk_col.name}\") FROM \"{table_name}\"), 0) + 1, false)"
                    ))
                except Exception as e:
                    # Certaines tables n'ont pas de sequence (ex: junction tables) /
                    # Some tables have no sequence (e.g., junction tables)
                    print(f"  [warn] Sequence {seq_name}: {e}")

    print(f"[migrate] Sequences resetees")

    await sqlite_engine.dispose()
    await pg_engine.dispose()

    print(f"\n{'=' * 50}")
    print(f"Migration terminee ! {total_rows} lignes migrees.")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    asyncio.run(migrate())
