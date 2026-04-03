"""Seed crate_types depuis les guides de tri / Seed crate types from sorting guides.

Usage: python seed_crate_types.py  (SQLite local)
Prod:  docker exec chaos-route-app-1 python seed_crate_types_pg.py
"""

import asyncio
from sqlalchemy import text
from app.database import engine
from sqlalchemy.ext.asyncio import async_sessionmaker

# (code, name, format, brand, sorting_rule)
# sorting_rule: SPECIFIC = caisse specifique (pas de melange), FORMAT_MIX = melange tolere par format
CRATE_TYPES = [
    # ── 33CL — Tri par caisse specifique ──
    ("QUIN33", "Quintine 24x33cl", "33CL", "Quintine", "SPECIFIC"),
    ("CORN33", "La Corne 24x33cl", "33CL", "La Corne", "SPECIFIC"),
    ("GRIM33", "Grimbergen 24x33cl", "33CL", "Grimbergen", "SPECIFIC"),
    ("WEST33", "Westmalle 24x33cl", "33CL", "Westmalle", "SPECIFIC"),
    ("CHIM33", "Chimay 24x33cl", "33CL", "Chimay", "SPECIFIC"),
    ("DELI33", "Delirium 24x33cl", "33CL", "Delirium", "SPECIFIC"),
    ("TRAP33", "La Trappe 24x33cl", "33CL", "La Trappe", "SPECIFIC"),
    ("FLOR33", "Floreffe 24x33cl", "33CL", "Floreffe", "SPECIFIC"),
    ("LEFE33", "Lefebvre 24x33cl", "33CL", "Lefebvre", "SPECIFIC"),
    ("ORVA33", "Orval 24x33cl", "33CL", "Orval", "SPECIFIC"),
    ("CAUL33", "Caulier 24x33cl", "33CL", "Caulier", "SPECIFIC"),
    ("PAIX33", "Paix Dieu 24x33cl", "33CL", "Paix Dieu", "SPECIFIC"),
    ("AFFL33", "Affligem 24x30cl", "33CL", "Affligem", "SPECIFIC"),
    ("DESP33", "Desperados 24x33cl", "33CL", "Desperados", "SPECIFIC"),
    ("STHU33", "St Hubertus 24x33cl", "33CL", "St Hubertus", "SPECIFIC"),
    ("ROCH33", "Rochehaut 24x33cl", "33CL", "Rochehaut", "SPECIFIC"),
    # ── 33CL — Tri par format (melange tolere) ──
    ("MIX33", "Casier generique 33cl (melange)", "33CL", None, "FORMAT_MIX"),

    # ── 25CL — Tri par caisse specifique ──
    ("CARL25", "Carlsberg 10x25cl", "25CL", "Carlsberg", "SPECIFIC"),
    ("MAES25", "Maes 10x25cl", "25CL", "Maes", "SPECIFIC"),
    ("STEL25", "Stella Artois 10x25cl", "25CL", "Stella Artois", "SPECIFIC"),
    ("TROL25", "Cuvee des Trolls 10x25cl", "25CL", "Cuvee des Trolls", "SPECIFIC"),
    ("GRIS25", "Grisette 10x25cl", "25CL", "Grisette", "SPECIFIC"),
    # ── 25CL — Tri par format (melange tolere) ──
    ("MIX25", "Casier generique 25cl (melange)", "25CL", None, "FORMAT_MIX"),

    # ── 75CL — Tri par caisse specifique ──
    ("CHIM75", "Chimay 12x75cl", "75CL", "Chimay", "SPECIFIC"),
    ("LUPU75", "Lupulus 12x75cl", "75CL", "Lupulus", "SPECIFIC"),
    ("CHOU75", "Chouffe 12x75cl", "75CL", "Chouffe", "SPECIFIC"),
    ("QUEU75", "Queue de Charrue 12x75cl", "75CL", "Queue de Charrue", "SPECIFIC"),
    ("PIED75", "Piedboeuf 12x75cl", "75CL", "Piedboeuf", "SPECIFIC"),
    # ── 75CL — Tri par format (melange tolere) ──
    ("MIX75", "Casier generique 75cl (melange)", "75CL", None, "FORMAT_MIX"),

    # ── 1L — Tri par caisse specifique (eau) ──
    ("ORDA1L", "Ordal 6x1L", "1L", "Ordal", "SPECIFIC"),
    ("SPA1L", "Spa 6x1L", "1L", "Spa", "SPECIFIC"),
    ("BRU1L", "Bru 6x1L", "1L", "Bru", "SPECIFIC"),

    # ── Futs 6L ──
    ("FUT6L", "Fut PerfectDraft 6L (melange)", "FUT6L", None, "FORMAT_MIX"),
]


async def main():
    session_factory = async_sessionmaker(engine)
    async with session_factory() as db:
        # Creer la table si elle n'existe pas
        try:
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS crate_types (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code VARCHAR(20) UNIQUE NOT NULL,
                    name VARCHAR(150) NOT NULL,
                    format VARCHAR(20) NOT NULL,
                    brand VARCHAR(100),
                    sorting_rule VARCHAR(20) DEFAULT 'SPECIFIC',
                    is_active BOOLEAN DEFAULT TRUE
                )
            """))
            await db.commit()
        except Exception:
            await db.rollback()

        inserted = 0
        for code, name, fmt, brand, rule in CRATE_TYPES:
            r = await db.execute(text("SELECT id FROM crate_types WHERE code=:code"), {"code": code})
            if r.scalar_one_or_none():
                print(f"  Skip (exists): {code} ({name})")
                continue
            await db.execute(text(
                "INSERT INTO crate_types (code, name, format, brand, sorting_rule, is_active) "
                "VALUES (:code, :name, :fmt, :brand, :rule, true)"
            ), {"code": code, "name": name, "fmt": fmt, "brand": brand, "rule": rule})
            inserted += 1
            print(f"  OK: {code} — {name}")

        await db.commit()
        print(f"\nDone: {inserted} crate types inserted.")


asyncio.run(main())
