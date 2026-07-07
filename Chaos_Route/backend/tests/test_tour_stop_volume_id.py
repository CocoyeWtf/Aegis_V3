"""Régression tickets #3/#6 : un PDV avec deux volumes de MÊME eqc (Gel 9.96 +
Frais 9.96). Chaque stop porte son volume_id → assignation ET libération EXACTES,
sans confusion entre les deux segments. / Regression for identical-eqc segments.
"""

import uuid

import pytest
from sqlalchemy import select


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


async def _make_volume(db_session, pdv, base, temp, eqp, date):
    from app.models.volume import Volume, TemperatureClass
    vol = Volume(
        pdv_id=pdv.id, date=date, dispatch_date=date, eqp_count=eqp,
        temperature_class=TemperatureClass(temp), base_origin_id=base.id, tour_id=None,
    )
    db_session.add(vol)
    await db_session.commit()
    await db_session.refresh(vol)
    return vol


@pytest.mark.asyncio
async def test_identical_eqc_volumes_assigned_and_freed_exactly(client, db_session, test_region):
    from app.models.volume import Volume

    date = "2026-06-10"
    base = await _make_base(db_session, test_region)
    pdv = await _make_pdv(db_session, test_region, f"P{uuid.uuid4().hex[:5].upper()}")
    # Deux volumes du MÊME PDV avec la MÊME eqc (le cas qui cassait) / same eqc
    gel = await _make_volume(db_session, pdv, base, "GEL", 9.96, date)
    frais = await _make_volume(db_session, pdv, base, "FRAIS", 9.96, date)

    # Créer le tour avec DEUX stops, chacun rattaché à son volume exact /
    # Create the tour with two stops, each carrying its exact volume_id
    payload = {
        "date": date,
        "code": f"T-{uuid.uuid4().hex[:8]}",
        "base_id": base.id,
        "status": "DRAFT",
        "total_eqp": 19.92,
        "stops": [
            {"pdv_id": pdv.id, "volume_id": gel.id, "sequence_order": 1, "eqp_count": 9.96},
            {"pdv_id": pdv.id, "volume_id": frais.id, "sequence_order": 2, "eqp_count": 9.96},
        ],
    }
    resp = await client.post("/api/tours/", json=payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    tour_id = body["id"]

    # Les deux stops persistent leur volume_id exact / both stops keep their volume_id
    stop_by_vol = {s["volume_id"]: s for s in body["stops"]}
    assert set(stop_by_vol) == {gel.id, frais.id}

    # Assignation EXACTE : chaque volume est rattaché au tour / exact assignment
    await db_session.refresh(gel)
    await db_session.refresh(frais)
    assert gel.tour_id == tour_id
    assert frais.tour_id == tour_id

    # Retirer le stop Gel → SEUL le volume Gel est libéré, le Frais reste /
    # Remove the Gel stop → ONLY the Gel volume is freed, Frais stays assigned
    gel_stop_id = stop_by_vol[gel.id]["id"]
    resp = await client.delete(f"/api/tours/{tour_id}/stops/{gel_stop_id}")
    assert resp.status_code == 200, resp.text

    await db_session.refresh(gel)
    await db_session.refresh(frais)
    assert gel.tour_id is None, "le volume Gel doit être libéré"
    assert frais.tour_id == tour_id, "le volume Frais NE doit PAS être libéré"

    # Il ne reste que le stop Frais / only the Frais stop remains
    remaining = body2_stops = resp.json()["stops"]
    assert len(remaining) == 1
    assert remaining[0]["volume_id"] == frais.id
