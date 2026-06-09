"""Tests tablette magasin : déclaration contenants par auth appareil (X-Device-ID)."""

import uuid

import pytest

from app.models.mobile_device import MobileDevice


async def _make_device(db_session, pdv_id=None):
    did = str(uuid.uuid4())
    dev = MobileDevice(
        device_identifier=did,
        registration_code=uuid.uuid4().hex[:8].upper(),
        is_active=True,
        pdv_id=pdv_id,
        profile="PDV" if pdv_id else "DRIVER",
        allowed_features="pdv_pickup" if pdv_id else "tours,pickups,declarations",
    )
    db_session.add(dev)
    await db_session.commit()
    return did


@pytest.mark.asyncio
async def test_device_pickup_scoped_to_its_pdv(client, db_session, test_pdv):
    """Une tablette liée à un PDV crée une déclaration scopée à CE magasin (PDV forcé)."""
    did = await _make_device(db_session, pdv_id=test_pdv.id)
    payload = {
        "pdv_id": 999999,  # doit être ignoré et forcé au pdv de la tablette
        "pickup_type": "MERCHANDISE",
        "quantity": 2,
        "availability_date": "2026-06-10",
    }
    r = await client.post("/api/pickup-requests/device", json=payload, headers={"X-Device-ID": did})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["pdv_id"] == test_pdv.id
    assert len(body["labels"]) == 2


@pytest.mark.asyncio
async def test_device_without_pdv_forbidden(client, db_session):
    """Un appareil non rattaché à un PDV ne peut pas déclarer via le chemin tablette."""
    did = await _make_device(db_session, pdv_id=None)
    payload = {"pdv_id": 1, "pickup_type": "MERCHANDISE", "quantity": 1, "availability_date": "2026-06-10"}
    r = await client.post("/api/pickup-requests/device", json=payload, headers={"X-Device-ID": did})
    assert r.status_code == 403, r.text


@pytest.mark.asyncio
async def test_device_unknown_unauthorized(client):
    """Sans appareil connu, 401."""
    payload = {"pdv_id": 1, "pickup_type": "MERCHANDISE", "quantity": 1, "availability_date": "2026-06-10"}
    r = await client.post("/api/pickup-requests/device", json=payload, headers={"X-Device-ID": "00000000-0000-0000-0000-000000000000"})
    assert r.status_code == 401, r.text
