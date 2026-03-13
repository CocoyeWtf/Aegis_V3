"""Seed support_types from Contenants.xlsx — remplace les entrées de test.
Executed once on the server to populate the reference data.
"""

import asyncio
from sqlalchemy import text
from app.database import engine
from sqlalchemy.ext.asyncio import async_sessionmaker

# 45 rows from Contenants.xlsx
# (code_long, short_code, name, unit_value, unit_quantity, unit_label)
ROWS = [
    ("CO 10005", "005", "MAXIGEL", 0, 1, None),
    ("CO 10010", "010", "MINIGEL", 0, 1, None),
    ("CO 10002", "002", "COMBIMER TER", 0, 5, "Par 5"),
    ("CO 10012", "012", "COMBI ENCASTR VOLET ANTICHUTE", 0, 1, None),
    ("CO 10014", "014", "COMBIMER ENC+BAC DE RETENTION", 165, 1, None),
    ("CO 00470", "891", "COMBIS METAL SUPERLOG", 0, 5, "Par 5"),
    ("CO 00412", "854", "COMBIS LOCATION", 60, 5, "Par 5"),
    ("PA 22000", "220", "PALETTE EUROPE BOIS 80*120", 9, 10, "Pile de 10"),
    ("PA 22004", "204", "PALETTE EUROPE CASSEE", 9, 1, None),
    ("PA 22020", "222", "PAL LOC 80*120", 0, 10, "Pile de 10"),
    ("PA 24020", "242", "PAL LOC 100*120", 0, 10, "Pile de 10"),
    ("PA 23020", "232", "PAL LOC 60*80", 0, 20, "Par 20"),
    ("PA 25020", "252", "PAL LOC 60*100", 0, 20, "Par 20"),
    ("PA 28020", "282", "1/4 PALETTE LOCATIVE", 0, 1, None),
    ("PA 22010", "221", "PALETTE PERDUE BOIS 80*120", 0, 10, "Pile de 10"),
    ("PA 24010", "241", "PALETTE PERDUE BOIS 100*120", 0, 10, "Pile de 10"),
    ("RE 52010", "510", "BALLE CARTON", 0, 1, None),
    ("RE 52020", "520", "BALLE PLASTIQUE", 0, 1, None),
    ("SF 40104", "414", "ROLL A FLEURS 4 ETAGERES", 87, 10, "Par 10"),
    ("SF 40204", "424", "1/2 ROLL A FLEURS 4 ETAGERES", 87, 10, "Par 10"),
    ("CO 80000", "080", "ROLL A FLEURS", 0, 1, None),
    ("CO 85000", "085", "1/2 ROLL A FLEURS", 0, 1, None),
    ("SF 30100", "700", "CASIER A BIERE PLEIN", 4.5, 1, None),
    ("SF 30101", "701", "CASIER A BIERE VIDE", 2.1, 1, None),
    ("SF 30400", "738", "CASIER 6X1L PLEIN", 3.5, 1, None),
    ("SF 30401", "739", "CASIER 6X1L VIDE", 2.3, 1, None),
    ("SF 34051", "668", "PERF DRAFT FUT 6L PL", 6, 1, None),
    ("SF 31414", "456", "CASIER PLEIN ALOTI VANUXEEM", 6, 1, None),
    ("SF 31415", "457", "CASIER VIDE ALLOTI VANUXEEM", 3.5, 1, None),
    ("SF 31416", "522", "CASIER PLEIN ALOTI VANUXEEM", 8.4, 1, None),
    ("SF 31418", "533", "CASIER PLEIN ALOTI VANUXEEM", 7, 1, None),
    ("SF 31419", "534", "CASIER VIDE ALLOTI VANUXEEM", 4.6, 1, None),
    ("SF 32149", "599", "CASIER PLEIN ALOTI VANUXEEM", 8, 1, None),
    ("SF 32148", "598", "CASIER PLEIN ALOTI VANUXEEM", 8.4, 1, None),
    ("SF 31417", "532", "CASIER VIDE ALLOTI VANUXEEM", 6.2, 1, None),
    ("SF 31434", "537", "CASIER PLEIN ALOTI VANUXEEM", 9.5, 1, None),
    ("SF 31432", "535", "CASIER PLEIN ALOTI VANUXEEM", 12, 1, None),
    ("SF 31433", "536", "CASIER VIDE ALLOTI VANUXEEM", 4, 1, None),
    ("SF 33520", "604", "DELIRIUM TREMENS 24X33CL PLEIN", 11.8, 1, None),
    ("SF 33521", "605", "DELIRIUM TREMENS 24X33CL VIDE", 4.6, 1, None),
    ("SF 34043", "963", "JUPILER 10X25CL PLEIN", 2.5, 1, None),
    ("SF 34044", "964", "JUPILER 10X25CL VIDE", 1.5, 1, None),
    ("SF 36000", "432", "CASIER NON TRIE", 2.1, 1, None),
    ("SF 31380", "959", "CASIER NON REPERTORIE", 0, 1, None),
    ("SF 40040", "448", "CAISSE PLAST BLEU BOUCHERI EPS", 3.86, 1, None),
]


async def main():
    session_factory = async_sessionmaker(engine)
    async with session_factory() as db:
        # 1. Add short_code column if missing
        try:
            await db.execute(text("ALTER TABLE support_types ADD COLUMN short_code VARCHAR(10)"))
            await db.commit()
            print("Column short_code added.")
        except Exception:
            await db.rollback()
            print("Column short_code already exists.")

        # 2. Update existing IDs 1, 2, 3 with first 3 Excel rows that make sense
        # id=1 was "Palette Europe" → map to PA 22000 (PALETTE EUROPE BOIS 80*120) = row index 7
        # id=2 was "Palette Chep" → no exact match, map to PA 22020 (PAL LOC 80*120) = row index 9
        # id=3 was "PAL_BAC" → map to CO 10005 (MAXIGEL) = row index 0
        # Actually simpler: just update id 1,2,3 with the first 3 rows and insert the rest
        # But let's be smarter: match id=1 to Palette Europe
        updates = {
            1: 7,   # PA 22000 PALETTE EUROPE BOIS 80*120
            2: 9,   # PA 22020 PAL LOC 80*120  (closest to CHEP which is locative)
            3: 0,   # CO 10005 MAXIGEL
        }
        used_indices = set(updates.values())

        for db_id, row_idx in updates.items():
            code, short_code, name, unit_value, unit_qty, unit_label = ROWS[row_idx]
            await db.execute(text(
                "UPDATE support_types SET code=:code, short_code=:short_code, name=:name, "
                "unit_value=:unit_value, unit_quantity=:unit_qty, unit_label=:unit_label, is_active=true "
                "WHERE id=:id"
            ), {
                "id": db_id, "code": code, "short_code": short_code, "name": name,
                "unit_value": unit_value, "unit_qty": unit_qty, "unit_label": unit_label,
            })
            print(f"  Updated id={db_id} → {code} ({name})")

        # 3. Insert remaining rows
        inserted = 0
        for i, (code, short_code, name, unit_value, unit_qty, unit_label) in enumerate(ROWS):
            if i in used_indices:
                continue
            # Check if code already exists
            r = await db.execute(text("SELECT id FROM support_types WHERE code=:code"), {"code": code})
            if r.scalar_one_or_none():
                print(f"  Skip (exists): {code} ({name})")
                continue
            await db.execute(text(
                "INSERT INTO support_types (code, short_code, name, unit_value, unit_quantity, unit_label, is_active) "
                "VALUES (:code, :short_code, :name, :unit_value, :unit_qty, :unit_label, true)"
            ), {
                "code": code, "short_code": short_code, "name": name,
                "unit_value": unit_value, "unit_qty": unit_qty, "unit_label": unit_label,
            })
            inserted += 1

        await db.commit()
        print(f"\nDone: 3 updated, {inserted} inserted.")

        # Verify
        r = await db.execute(text("SELECT id, code, short_code, name, unit_value, unit_quantity FROM support_types ORDER BY id"))
        for row in r.all():
            print(f"  {row}")


asyncio.run(main())
