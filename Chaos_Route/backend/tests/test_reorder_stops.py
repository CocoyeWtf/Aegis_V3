"""Tests réordonnancement des arrêts d'un tour / Tour stop reorder tests."""

import uuid

import pytest


async def _make_base(db_session, region):
    from app.models.base_logistics import BaseLogistics
    base = BaseLogistics(code=f"B{uuid.uuid4().hex[:5].upper()}", name="Base", region_id=region.id)
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


async def _make_tour_with_stops(db_session, base, region, pdv_codes):
    from app.models.tour import Tour, TourStatus
    from app.models.tour_stop import TourStop
    tour = Tour(
        date="2026-06-10", code=f"T-{uuid.uuid4().hex[:8]}", base_id=base.id,
        status=TourStatus.DRAFT,
    )
    db_session.add(tour)
    await db_session.commit()
    await db_session.refresh(tour)
    stop_ids = []
    for seq, code in enumerate(pdv_codes, start=1):
        pdv = await _make_pdv(db_session, region, code)
        s = TourStop(tour_id=tour.id, pdv_id=pdv.id, sequence_order=seq, eqp_count=1)
        db_session.add(s)
        await db_session.commit()
        await db_session.refresh(s)
        stop_ids.append(s.id)
    return tour, stop_ids


@pytest.mark.asyncio
async def test_reorder_stops(client, db_session, test_region):
    base = await _make_base(db_session, test_region)
    tour, stop_ids = await _make_tour_with_stops(
        db_session, base, test_region, [f"A{uuid.uuid4().hex[:4]}", f"B{uuid.uuid4().hex[:4]}", f"C{uuid.uuid4().hex[:4]}"],
    )
    # Inverser l'ordre / Reverse the order
    new_order = list(reversed(stop_ids))
    resp = await client.put(f"/api/tours/{tour.id}/reorder-stops", json={"stop_order": new_order})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    stops_sorted = sorted(body["stops"], key=lambda s: s["sequence_order"])
    assert [s["id"] for s in stops_sorted] == new_order


@pytest.mark.asyncio
async def test_reorder_stops_rejects_incomplete(client, db_session, test_region):
    base = await _make_base(db_session, test_region)
    tour, stop_ids = await _make_tour_with_stops(
        db_session, base, test_region, [f"D{uuid.uuid4().hex[:4]}", f"E{uuid.uuid4().hex[:4]}"],
    )
    # stop_order incomplet (un seul id) -> 422
    resp = await client.put(f"/api/tours/{tour.id}/reorder-stops", json={"stop_order": [stop_ids[0]]})
    assert resp.status_code == 422
