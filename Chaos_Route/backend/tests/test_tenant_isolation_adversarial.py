"""Tests ADVERSES d'isolation multi-tenant : le tenant A tente d'atteindre les
données du tenant B par chaque chemin cartographié — l'accès DOIT échouer.

Rejouables en CI. Chaque test échoue si l'isolation régresse.
"""

import tempfile
import uuid
from pathlib import Path

import pytest
from fastapi import Depends
from sqlalchemy import select

from app.database import get_db, set_session_tenant
from app.models.tenant import Tenant


async def _make_scoped_user(db_session, *, tenant_id, regions, perms):
    """User non-superadmin avec rôle/permissions/régions (réplique le câblage réel)."""
    from app.models.user import Permission, Role, User
    role = Role(name=f"role_{uuid.uuid4().hex[:8]}")
    role.permissions = [Permission(resource=r, action=a) for (r, a) in perms]
    db_session.add(role)
    await db_session.commit()
    u = User(
        username=f"u_{uuid.uuid4().hex[:8]}", email=f"{uuid.uuid4().hex[:8]}@iso.test",
        hashed_password="x", is_active=True, is_superadmin=False, tenant_id=tenant_id,
    )
    u.roles = [role]
    u.regions = list(regions)
    db_session.add(u)
    await db_session.commit()
    u = (await db_session.execute(select(User).where(User.id == u.id))).scalar_one()
    _ = [(p.resource, p.action) for ro in u.roles for p in ro.permissions]
    _ = [r.id for r in u.regions]
    return u


def _override_current_user(user):
    """Override get_current_user reproduisant la pose du tenant sur la session."""
    from app.api.deps import get_user_tenant_id

    async def _dep(db=Depends(get_db)):
        set_session_tenant(db, get_user_tenant_id(user))
        return user
    return _dep


# ─────────────────────────────────────────────────────────────────────────────
# C1 — WebSocket tracking : broadcast cloisonné par tenant
# ─────────────────────────────────────────────────────────────────────────────

class _FakeWS:
    """Faux WebSocket capturant les messages envoyés / Fake WS capturing sends."""
    def __init__(self):
        self.sent: list[str] = []
        self.accepted = False

    async def accept(self):
        self.accepted = True

    async def send_text(self, data: str):
        self.sent.append(data)


@pytest.mark.asyncio
async def test_ws_broadcast_is_tenant_scoped():
    """Un client du tenant B ne doit PAS recevoir un événement du tenant A.
    Un client consolidation (tenant None) reçoit tout. / WS broadcast partitioning."""
    from app.api.ws_tracking import TrackingConnectionManager

    mgr = TrackingConnectionManager()
    ws_a = _FakeWS()      # tenant 1
    ws_b = _FakeWS()      # tenant 2
    ws_admin = _FakeWS()  # consolidation (None) — voit tout
    await mgr.connect(ws_a, tenant_id=1)
    await mgr.connect(ws_b, tenant_id=2)
    await mgr.connect(ws_admin, tenant_id=None)

    # Événement GPS émis pour le tenant 1
    await mgr.broadcast({"type": "gps_update", "tour_code": "T-A", "latitude": 50.0}, tenant_id=1)

    assert len(ws_a.sent) == 1, "le client du tenant émetteur doit recevoir"
    assert len(ws_b.sent) == 0, "FUITE : un client d'un autre tenant a reçu l'événement"
    assert len(ws_admin.sent) == 1, "un client consolidation doit tout recevoir"

    # Événement du tenant 2 : seul B (+ admin) le reçoit
    await mgr.broadcast({"type": "gps_update", "tour_code": "T-B"}, tenant_id=2)
    assert len(ws_a.sent) == 1, "FUITE : le tenant 1 a reçu un événement du tenant 2"
    assert len(ws_b.sent) == 1
    assert len(ws_admin.sent) == 2


@pytest.mark.asyncio
async def test_ws_broadcast_requires_tenant_id():
    """broadcast() SANS tenant_id doit lever (pas de diffusion à tout le monde). /
    Forgetting the tenant is an error, never a silent broadcast-to-all."""
    from app.api.ws_tracking import TrackingConnectionManager
    mgr = TrackingConnectionManager()
    with pytest.raises(TypeError):
        await mgr.broadcast({"type": "x"})  # type: ignore[call-arg]


# ─────────────────────────────────────────────────────────────────────────────
# C2 — Endpoints fichiers : auth requise + cloisonnement tenant
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_temperature_photo_is_tenant_scoped(db_session, test_region):
    """Un user du tenant B ne doit PAS pouvoir récupérer la photo d'un contrôle
    température du tenant A (404) ; le propriétaire (tenant A) l'obtient (200)."""
    from httpx import ASGITransport, AsyncClient
    from app.api.deps import get_current_user
    from app.main import app
    from app.models.temperature_check import TemperatureCheck, TempCheckpoint

    ta = Tenant(code=f"TA{uuid.uuid4().hex[:4]}", name="Tenant TA")
    tb = Tenant(code=f"TB{uuid.uuid4().hex[:4]}", name="Tenant TB")
    db_session.add_all([ta, tb])
    await db_session.commit()

    # Fichier photo réel + contrôle température stampé tenant A
    tmp = Path(tempfile.gettempdir()) / f"tc_{uuid.uuid4().hex[:8]}.jpg"
    tmp.write_bytes(b"\xff\xd8\xff\xe0JFIF-fake")
    set_session_tenant(db_session, ta.id)
    check = TemperatureCheck(
        tour_id=1, checkpoint=TempCheckpoint.DEPARTURE_CHECK, temperature=4.0,
        timestamp="2026-07-08T08:00:00", photo_path=str(tmp),
    )
    db_session.add(check)
    await db_session.commit()
    check_id = check.id
    set_session_tenant(db_session, None)

    user_b = await _make_scoped_user(db_session, tenant_id=tb.id, regions=[test_region],
                                     perms=[("temperature", "read")])
    user_a = await _make_scoped_user(db_session, tenant_id=ta.id, regions=[test_region],
                                     perms=[("temperature", "read")])
    try:
        transport = ASGITransport(app=app)
        # Tenant B → 404 (cloisonné) / cross-tenant blocked
        app.dependency_overrides[get_current_user] = _override_current_user(user_b)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            leak = await ac.get(f"/api/temperature/checks/{check_id}/photo")
        assert leak.status_code == 404, f"FUITE cross-tenant photo temperature: {leak.status_code}"
        # Tenant A (propriétaire) → 200 / owner gets it
        app.dependency_overrides[get_current_user] = _override_current_user(user_a)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            own = await ac.get(f"/api/temperature/checks/{check_id}/photo")
        assert own.status_code == 200, own.text
    finally:
        app.dependency_overrides.clear()
        tmp.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_file_endpoints_require_auth():
    """Sans authentification, les endpoints fichiers ne servent RIEN (plus de
    récupération anonyme par énumération d'ID)."""
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    app.dependency_overrides.clear()  # aucun override → vraie sécurité active
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        paths = [
            "/api/temperature/checks/1/photo",
            "/api/declarations/1/photos/1",
            "/api/inspections/1/photos/1",
            "/api/pdvs/plans/whatever.pdf",
        ]
        for p in paths:
            r = await ac.get(p)
            assert r.status_code in (401, 403), f"{p} accessible sans auth ({r.status_code})"


# ─────────────────────────────────────────────────────────────────────────────
# M3 — db.get() sur un modèle TenantMixin est-il filtré ? (identity-map)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_db_get_is_tenant_filtered_in_fresh_session(db_session):
    """Dans une SESSION FRAÎCHE (comme une vraie requête HTTP), Session.get(Model, id)
    sur un modèle TenantMixin ne doit PAS renvoyer la ligne d'un autre tenant.
    Résout la question du bypass via l'identity-map soulevée à l'audit."""
    from app.database import async_session
    from app.models.distance_matrix import DistanceMatrix

    ta = Tenant(code=f"GA{uuid.uuid4().hex[:4]}", name="GA")
    tb = Tenant(code=f"GB{uuid.uuid4().hex[:4]}", name="GB")
    db_session.add_all([ta, tb])
    await db_session.commit()

    set_session_tenant(db_session, ta.id)
    dm = DistanceMatrix(origin_type="BASE", origin_id=771, destination_type="PDV",
                        destination_id=771, distance_km=1.0, duration_minutes=1)
    db_session.add(dm)
    await db_session.commit()
    did = dm.id
    set_session_tenant(db_session, None)

    # Session neuve, tenant B (identity-map vide, comme en requête réelle)
    async with async_session() as s2:
        set_session_tenant(s2, tb.id)
        got = await s2.get(DistanceMatrix, did)
    assert got is None, "FUITE : db.get() a renvoyé la ligne d'un autre tenant (identity-map)"
