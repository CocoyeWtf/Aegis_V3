"""Tests remédiation STIME A5 — audit généralisé des mutations ORM.

Toute mutation métier (CREATE/UPDATE/DELETE, n'importe quel modèle) doit
produire une entrée d'audit avec acteur, diff et horodatage ; les champs
sensibles et les tables à haut volume sont exclus.
"""

import json
import uuid

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog


async def _audit_rows(db_session, entity_type: str, entity_id: int):
    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id,
        ).order_by(AuditLog.id)
    )
    return result.scalars().all()


@pytest.mark.asyncio
async def test_create_update_delete_are_audited(db_session):
    from app.models.country import Country

    db_session.info["actor"] = "auditor_test"
    code = f"Z{uuid.uuid4().hex[:2].upper()}"

    country = Country(name=f"Pays {code}", code=code)
    db_session.add(country)
    await db_session.commit()
    cid = country.id

    rows = await _audit_rows(db_session, "countries", cid)
    assert [r.action for r in rows] == ["CREATE"]
    assert rows[0].user == "auditor_test"
    assert code in rows[0].changes

    country.name = f"Pays {code} renommé"
    await db_session.commit()

    rows = await _audit_rows(db_session, "countries", cid)
    assert [r.action for r in rows] == ["CREATE", "UPDATE"]
    diff = json.loads(rows[1].changes)
    assert diff["name"][0] == f"Pays {code}"
    assert diff["name"][1] == f"Pays {code} renommé"

    await db_session.delete(country)
    await db_session.commit()

    rows = await _audit_rows(db_session, "countries", cid)
    assert [r.action for r in rows] == ["CREATE", "UPDATE", "DELETE"]


@pytest.mark.asyncio
async def test_sensitive_fields_never_logged(db_session, test_user):
    db_session.info["actor"] = "auditor_test"
    test_user.hashed_password = "nouveau-hash-quelconque"
    await db_session.commit()

    rows = await _audit_rows(db_session, "users", test_user.id)
    for row in rows:
        assert row.changes is None or "hash" not in row.changes.lower()


@pytest.mark.asyncio
async def test_high_volume_tables_excluded(db_session):
    from app.models.gps_position import GPSPosition

    gps = GPSPosition(device_id=888888, tour_id=888888, latitude=50.0,
                      longitude=4.0, timestamp="2026-07-08T10:00:00+00:00")
    db_session.add(gps)
    await db_session.commit()

    rows = await _audit_rows(db_session, "gps_positions", gps.id)
    assert rows == []


@pytest.mark.asyncio
async def test_api_mutation_records_actor(db_session):
    """Preuve E2E : une mutation via l'API porte l'acteur authentifié (JWT réel)."""
    from httpx import ASGITransport, AsyncClient

    from app.main import app
    from app.models.user import User
    from app.utils.auth import hash_password

    sfx = uuid.uuid4().hex[:8]
    pwd = f"Acteur!Solide#{sfx}"
    user = User(
        username=f"actor_{sfx}", email=f"actor-{sfx}@chaos-route.app",
        hashed_password=hash_password(pwd), is_active=True, is_superadmin=True,
    )
    db_session.add(user)
    await db_session.commit()

    app.state.limiter.enabled = False
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/api/auth/login", json={"username": user.username, "password": pwd})
        assert resp.status_code == 200, resp.text
        headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

        code = f"Y{uuid.uuid4().hex[:2].upper()}"
        resp = await ac.post("/api/countries/", json={"name": f"Pays {code}", "code": code},
                             headers=headers)
        assert resp.status_code == 201, resp.text
        country_id = resp.json()["id"]
    app.state.limiter.enabled = True

    # NB : filtrer sur le code unique — SQLite peut réutiliser l'id d'un pays
    # supprimé par un test précédent (les vieilles lignes d'audit subsistent).
    rows = [r for r in await _audit_rows(db_session, "countries", country_id)
            if r.action == "CREATE" and r.changes and code in r.changes]
    assert rows, "la création via l'API doit être auditée"
    assert rows[0].user == user.username
