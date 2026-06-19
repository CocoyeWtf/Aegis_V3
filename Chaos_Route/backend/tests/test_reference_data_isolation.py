"""Isolation des données de référence (distancier, taxe km) + garde KPI région.

Prouve, au niveau ORM ET au niveau API, que :
- `distance_matrix` et `km_tax` sont cloisonnés par tenant (la fuite cross-pays
  identifiée à l'audit : un tenant ne voit pas les distances/taxes d'un autre) ;
- l'endpoint `GET /distance-matrix/` ne renvoie que les lignes du tenant courant ;
- les KPI refusent (403) une `region_id` hors du périmètre de l'utilisateur.

C'est la preuve d'étanchéité réclamée avant l'onboarding d'un 2ᵉ pays (France).
"""

import uuid

import pytest
from fastapi import Depends
from sqlalchemy import select

from app.database import get_db, set_session_tenant
from app.models.distance_matrix import DistanceMatrix
from app.models.km_tax import KmTax
from app.models.tenant import Tenant


# ─── Niveau ORM : le filtre central s'applique bien aux 2 modèles de référence ───

@pytest.mark.asyncio
async def test_distance_matrix_tenant_isolation(db_session):
    ta = Tenant(code=f"DA{uuid.uuid4().hex[:4]}", name="Tenant DA")
    tb = Tenant(code=f"DB{uuid.uuid4().hex[:4]}", name="Tenant DB")
    db_session.add_all([ta, tb])
    await db_session.commit()

    set_session_tenant(db_session, ta.id)
    da = DistanceMatrix(origin_type="BASE", origin_id=1, destination_type="PDV",
                        destination_id=1, distance_km=10, duration_minutes=15)
    db_session.add(da)
    await db_session.commit()

    set_session_tenant(db_session, tb.id)
    db_ = DistanceMatrix(origin_type="BASE", origin_id=2, destination_type="PDV",
                         destination_id=2, distance_km=20, duration_minutes=25)
    db_session.add(db_)
    await db_session.commit()

    # Stampage automatique correct / correct auto-stamping
    assert da.tenant_id == ta.id
    assert db_.tenant_id == tb.id

    # Lecture sous tenant A : ne voit que A / sees only A
    set_session_tenant(db_session, ta.id)
    ids = {d.id for d in (await db_session.execute(select(DistanceMatrix))).scalars().all()}
    assert da.id in ids
    assert db_.id not in ids

    set_session_tenant(db_session, None)


@pytest.mark.asyncio
async def test_km_tax_tenant_isolation(db_session):
    ta = Tenant(code=f"KA{uuid.uuid4().hex[:4]}", name="Tenant KA")
    tb = Tenant(code=f"KB{uuid.uuid4().hex[:4]}", name="Tenant KB")
    db_session.add_all([ta, tb])
    await db_session.commit()

    set_session_tenant(db_session, ta.id)
    ka = KmTax(origin_type="BASE", origin_id=1, destination_type="PDV", destination_id=1, tax_per_km=0.12)
    db_session.add(ka)
    await db_session.commit()

    set_session_tenant(db_session, tb.id)
    kb = KmTax(origin_type="BASE", origin_id=2, destination_type="PDV", destination_id=2, tax_per_km=0.34)
    db_session.add(kb)
    await db_session.commit()

    assert ka.tenant_id == ta.id
    assert kb.tenant_id == tb.id

    set_session_tenant(db_session, ta.id)
    ids = {k.id for k in (await db_session.execute(select(KmTax))).scalars().all()}
    assert ka.id in ids
    assert kb.id not in ids

    set_session_tenant(db_session, None)


# ─── Helper : utilisateur restreint (non-superadmin) avec rôle/permissions ───

async def _make_scoped_user(db_session, *, tenant_id, regions, perms):
    """Créer un user non-superadmin avec un rôle portant `perms` + régions données."""
    from app.models.user import Permission, Role, User

    role = Role(name=f"role_{uuid.uuid4().hex[:8]}")
    role.permissions = [Permission(resource=r, action=a) for (r, a) in perms]
    db_session.add(role)
    await db_session.commit()

    u = User(
        username=f"u_{uuid.uuid4().hex[:8]}",
        email=f"{uuid.uuid4().hex[:8]}@iso.test",
        hashed_password="x",
        is_active=True,
        is_superadmin=False,
        tenant_id=tenant_id,
    )
    u.roles = [role]
    u.regions = list(regions)
    db_session.add(u)
    await db_session.commit()

    # Recharger avec relations chargées (selectin) pour éviter tout lazy-load détaché /
    # Reload with relations eagerly loaded to avoid detached lazy-load in the request
    u = (await db_session.execute(select(User).where(User.id == u.id))).scalar_one()
    _ = [(p.resource, p.action) for ro in u.roles for p in ro.permissions]
    _ = [r.id for r in u.regions]
    return u


def _override_current_user(user):
    """Override get_current_user qui REPRODUIT le câblage tenant de la vraie deps."""
    from app.api.deps import get_user_tenant_id

    async def _dep(db=Depends(get_db)):
        set_session_tenant(db, get_user_tenant_id(user))
        return user
    return _dep


# ─── Niveau API : l'endpoint distancier ne renvoie que le tenant courant ───

@pytest.mark.asyncio
async def test_distance_matrix_endpoint_scoped_by_tenant(db_session, test_region):
    from httpx import ASGITransport, AsyncClient

    from app.api.deps import get_current_user
    from app.main import app

    ta = Tenant(code=f"EA{uuid.uuid4().hex[:4]}", name="Tenant EA")
    tb = Tenant(code=f"EB{uuid.uuid4().hex[:4]}", name="Tenant EB")
    db_session.add_all([ta, tb])
    await db_session.commit()

    # Valeurs uniques pour repérer les lignes dans la réponse / unique markers
    set_session_tenant(db_session, ta.id)
    db_session.add(DistanceMatrix(origin_type="BASE", origin_id=901, destination_type="PDV",
                                  destination_id=901, distance_km=111.11, duration_minutes=11))
    await db_session.commit()
    set_session_tenant(db_session, tb.id)
    db_session.add(DistanceMatrix(origin_type="BASE", origin_id=902, destination_type="PDV",
                                  destination_id=902, distance_km=222.22, duration_minutes=22))
    await db_session.commit()
    set_session_tenant(db_session, None)

    user_a = await _make_scoped_user(db_session, tenant_id=ta.id, regions=[test_region],
                                     perms=[("distances", "read")])
    app.dependency_overrides[get_current_user] = _override_current_user(user_a)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/distance-matrix/", params={"limit": 5000})
        assert resp.status_code == 200, resp.text
        kms = {round(float(r["distance_km"]), 2) for r in resp.json()}
        assert 111.11 in kms          # sa propre donnée / its own data
        assert 222.22 not in kms      # PAS la donnée de l'autre tenant / NOT the other tenant's
    finally:
        app.dependency_overrides.clear()


# ─── Niveau API : un KPI refuse une région hors périmètre (403) ───

@pytest.mark.asyncio
async def test_kpi_region_guard_forbidden(db_session, test_region):
    from httpx import ASGITransport, AsyncClient

    from app.api.deps import get_current_user
    from app.main import app

    user = await _make_scoped_user(db_session, tenant_id=None, regions=[test_region],
                                   perms=[("dashboard", "read")])
    app.dependency_overrides[get_current_user] = _override_current_user(user)
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # region_id hors périmètre (inexistante) → 403
            forbidden = await ac.get("/api/kpi/punctuality", params={
                "date_from": "2026-01-01", "date_to": "2026-12-31", "region_id": 999999,
            })
            # region_id du périmètre → autorisé (pas un 403)
            allowed = await ac.get("/api/kpi/punctuality", params={
                "date_from": "2026-01-01", "date_to": "2026-12-31", "region_id": test_region.id,
            })
        assert forbidden.status_code == 403, forbidden.text
        assert allowed.status_code != 403, allowed.text
    finally:
        app.dependency_overrides.clear()
