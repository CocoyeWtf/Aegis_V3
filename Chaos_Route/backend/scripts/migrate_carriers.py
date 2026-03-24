"""One-shot migration: create carriers from existing contract transporter_names."""
import asyncio
from app.database import engine
from sqlalchemy import text


async def migrate():
    async with engine.begin() as conn:
        r = await conn.execute(text(
            "SELECT DISTINCT transporter_name FROM contracts "
            "WHERE transporter_name IS NOT NULL "
            "ORDER BY transporter_name"
        ))
        names = [row[0] for row in r.fetchall() if row[0] and row[0].strip()]
        print(f"Found {len(names)} distinct transporter names")

        for name in names:
            code = name.upper().replace(" ", "_").replace(".", "")[:20]
            existing = await conn.execute(
                text("SELECT id FROM carriers WHERE code = :code"),
                {"code": code},
            )
            if existing.fetchone():
                print(f"  SKIP {code} (exists)")
                continue
            await conn.execute(
                text("INSERT INTO carriers (code, name, region_id) VALUES (:code, :name, 1)"),
                {"code": code, "name": name},
            )
            print(f"  CREATED: {code} -> {name}")

        r = await conn.execute(text("SELECT id, name FROM carriers"))
        carriers = {row[1]: row[0] for row in r.fetchall()}

        updated = 0
        for name, cid in carriers.items():
            result = await conn.execute(
                text("UPDATE contracts SET carrier_id = :cid WHERE transporter_name = :name"),
                {"cid": cid, "name": name},
            )
            if result.rowcount:
                print(f"  LINKED {result.rowcount} contracts -> {name} (id={cid})")
                updated += result.rowcount

        print(f"\nDone: {len(carriers)} carriers, {updated} contracts linked")


asyncio.run(migrate())
