"""Tests tour Transfert PDV à PDV / PDV-to-PDV transfer tour tests.

Un transfert est une nature de tour non-livraison, avec 2 arrêts (origine =
chargement, destination = dépose), sans quantité, et un commentaire libre.
"""

import uuid

import pytest


async def _make_base(db_session, region):
    from app.models.base_logistics import BaseLogistics

    base = BaseLogistics(
        code=f"B{uuid.uuid4().hex[:5].upper()}",
        name="Base Transfert Test",
        region_id=region.id,
    )
    db_session.add(base)
    await db_session.commit()
    await db_session.refresh(base)
    return base


async def _make_pdv(db_session, region, code):
    from app.models.pdv import PDV, PDVType

    pdv = PDV(code=code, name=f"PDV {code}", type=PDVType.HYPER, region_id=region.id)
    db_session.add(pdv)
    await db_session.commit()
    await db_session.refresh(pdv)
    return pdv


@pytest.mark.asyncio
async def test_create_transfert_pdv(client, db_session, test_region):
    base = await _make_base(db_session, test_region)
    origin = await _make_pdv(db_session, test_region, f"O{uuid.uuid4().hex[:4]}")
    dest = await _make_pdv(db_session, test_region, f"D{uuid.uuid4().hex[:4]}")

    payload = {
        "date": "2026-06-09",
        "code": f"TR-{uuid.uuid4().hex[:8]}",
        "base_id": base.id,
        "status": "DRAFT",
        "tour_type": "TRANSFERT_PDV",
        "is_pickup_tour": False,
        "remarks": "Transfert palettes vides A vers B",
        "stops": [
            {"pdv_id": origin.id, "sequence_order": 1, "eqp_count": 0},
            {"pdv_id": dest.id, "sequence_order": 2, "eqp_count": 0},
        ],
    }
    resp = await client.post("/api/tours/", json=payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["tour_type"] == "TRANSFERT_PDV"
    assert body["is_pickup_tour"] is False
    assert body["remarks"] == "Transfert palettes vides A vers B"
    assert len(body["stops"]) == 2
    seqs = sorted(s["sequence_order"] for s in body["stops"])
    assert seqs == [1, 2]
    pdv_ids = {s["pdv_id"] for s in body["stops"]}
    assert pdv_ids == {origin.id, dest.id}


@pytest.mark.asyncio
async def test_create_movement_with_comment(client, db_session, test_region):
    """Le commentaire (remarks) est aussi persisté pour un mouvement sans arrêt."""
    base = await _make_base(db_session, test_region)
    payload = {
        "date": "2026-06-09",
        "code": f"M-{uuid.uuid4().hex[:8]}",
        "base_id": base.id,
        "status": "DRAFT",
        "tour_type": "DEPLACEMENT_BASE",
        "is_pickup_tour": False,
        "destination": "Base Sud",
        "remarks": "Retour à vide après panne",
        "stops": [],
    }
    resp = await client.post("/api/tours/", json=payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["tour_type"] == "DEPLACEMENT_BASE"
    assert body["remarks"] == "Retour à vide après panne"
    assert body["stops"] == []
