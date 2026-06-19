"""Tests de cloisonnement multi-tenant / Multi-tenant isolation tests.

Vérifie que le filtrage central (do_orm_execute) et le stampage (before_flush)
isolent bien les données par tenant, et que l'absence de tenant (consolidation)
donne accès à tout.
"""

import uuid

import pytest
from sqlalchemy import select

from app.database import set_session_tenant
from app.models.carrier import Carrier
from app.models.tenant import Tenant


@pytest.mark.asyncio
async def test_tenant_isolation_and_stamping(db_session, test_region):
    # Deux tenants distincts / Two distinct tenants
    ta = Tenant(code=f"A{uuid.uuid4().hex[:4]}", name="Tenant A")
    tb = Tenant(code=f"B{uuid.uuid4().hex[:4]}", name="Tenant B")
    db_session.add_all([ta, tb])
    await db_session.commit()

    # Création sous tenant A -> stampage automatique / auto-stamping under tenant A
    set_session_tenant(db_session, ta.id)
    ca = Carrier(code=f"CA{uuid.uuid4().hex[:5]}", name="Carrier A", region_id=test_region.id)
    db_session.add(ca)
    await db_session.commit()

    # Création sous tenant B / under tenant B
    set_session_tenant(db_session, tb.id)
    cb = Carrier(code=f"CB{uuid.uuid4().hex[:5]}", name="Carrier B", region_id=test_region.id)
    db_session.add(cb)
    await db_session.commit()

    # Stampage correct / correct stamping
    assert ca.tenant_id == ta.id
    assert cb.tenant_id == tb.id

    # Lecture sous tenant A : ne voit QUE les données de A / sees ONLY tenant A data
    set_session_tenant(db_session, ta.id)
    res = await db_session.execute(select(Carrier))
    rows = res.scalars().all()
    ids = {c.id for c in rows}
    assert ca.id in ids
    assert cb.id not in ids
    assert all(c.tenant_id == ta.id for c in rows)

    # Lecture consolidation (tenant=None) : voit tout / sees everything
    set_session_tenant(db_session, None)
    res = await db_session.execute(select(Carrier))
    ids = {c.id for c in res.scalars().all()}
    assert ca.id in ids
    assert cb.id in ids

    # Nettoyage du tenant sur la session / reset session tenant
    set_session_tenant(db_session, None)


@pytest.mark.asyncio
async def test_skip_tenant_filter_option(db_session, test_region):
    """L'option d'exécution skip_tenant_filter doit lever le filtre ponctuellement."""
    tc = Tenant(code=f"C{uuid.uuid4().hex[:4]}", name="Tenant C")
    db_session.add(tc)
    await db_session.commit()

    set_session_tenant(db_session, tc.id)
    cc = Carrier(code=f"CC{uuid.uuid4().hex[:5]}", name="Carrier C", region_id=test_region.id)
    db_session.add(cc)
    await db_session.commit()

    # Sous un AUTRE tenant, normalement invisible / under another tenant: invisible
    set_session_tenant(db_session, tc.id + 9999)
    res = await db_session.execute(select(Carrier))
    assert cc.id not in {c.id for c in res.scalars().all()}

    # Avec skip_tenant_filter : visible / with skip_tenant_filter: visible
    res = await db_session.execute(
        select(Carrier), execution_options={"skip_tenant_filter": True}
    )
    assert cc.id in {c.id for c in res.scalars().all()}

    set_session_tenant(db_session, None)
