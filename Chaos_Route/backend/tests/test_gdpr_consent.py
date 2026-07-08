"""Tests remédiation STIME A7 — consentement GPS + portabilité RGPD (Art. 20).

Couvre : notice d'information versionnée, enregistrement append-only du choix
du chauffeur, opt-out effectif à l'ingestion GPS (défense en profondeur),
export self-service /my-data, export chauffeur externe par plaque.
"""

import uuid

import pytest


async def _make_device(db_session):
    from app.models.mobile_device import MobileDevice

    did = f"dev-{uuid.uuid4().hex[:10]}"
    device = MobileDevice(
        device_identifier=did,
        registration_code=uuid.uuid4().hex[:8].upper(),
        is_active=True,
        profile="DRIVER",
        allowed_features="tours,pickups,declarations",
    )
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)
    return device


async def _make_tour_with_assignment(db_session, test_region, device):
    from app.models.base_logistics import BaseLogistics
    from app.models.device_assignment import DeviceAssignment
    from app.models.tour import Tour, TourStatus

    base = BaseLogistics(code=f"B{uuid.uuid4().hex[:5].upper()}", name="Base", region_id=test_region.id)
    db_session.add(base)
    await db_session.flush()
    tour = Tour(date="2026-07-08", code=f"T-{uuid.uuid4().hex[:8]}", base_id=base.id,
                status=TourStatus.VALIDATED)
    db_session.add(tour)
    await db_session.flush()
    db_session.add(DeviceAssignment(tour_id=tour.id, device_id=device.id, date="2026-07-08"))
    await db_session.commit()
    await db_session.refresh(tour)
    return tour


@pytest.mark.asyncio
async def test_gps_privacy_notice_is_public_and_versioned(client):
    resp = await client.get("/api/gdpr/privacy-notice/gps")
    assert resp.status_code == 200
    data = resp.json()
    assert data["version"]
    assert "Finalité" in data["text"]
    assert "60 jours" in data["text"]


@pytest.mark.asyncio
async def test_consent_flow_and_gps_opt_out(client, db_session, test_region):
    device = await _make_device(db_session)
    tour = await _make_tour_with_assignment(db_session, test_region, device)
    headers = {"X-Device-ID": device.device_identifier}

    # Aucun choix enregistré : granted=None (l'app doit afficher la notice)
    resp = await client.get("/api/gdpr/consent/device/gps_tracking", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["granted"] is None

    gps_payload = {
        "tour_id": tour.id,
        "positions": [{
            "latitude": 50.5, "longitude": 4.5, "accuracy": 5.0, "speed": 60.0,
            "timestamp": "2026-07-08T10:00:00+00:00",
        }],
    }

    # Sans refus explicite, l'ingestion fonctionne (intérêt légitime + notice)
    resp = await client.post("/api/driver/gps", json=gps_payload, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["inserted"] == 1

    # Le chauffeur refuse le suivi / Driver opts out
    resp = await client.post(
        "/api/gdpr/consent/device",
        json={"consent_type": "gps_tracking", "granted": False, "subject_name": "Chauffeur Test"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    resp = await client.get("/api/gdpr/consent/device/gps_tracking", headers=headers)
    assert resp.json()["granted"] is False

    # Les positions sont désormais ignorées côté serveur / Positions now dropped
    resp = await client.post("/api/driver/gps", json=gps_payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["inserted"] == 0

    # Le chauffeur ré-accepte : l'ingestion reprend (journal append-only)
    resp = await client.post(
        "/api/gdpr/consent/device",
        json={"consent_type": "gps_tracking", "granted": True},
        headers=headers,
    )
    assert resp.status_code == 200
    resp = await client.post("/api/driver/gps", json=gps_payload, headers=headers)
    assert resp.json()["inserted"] == 1

    # Traçabilité : le journal contient les deux choix / Log holds both choices
    resp = await client.get("/api/gdpr/consents/")
    assert resp.status_code == 200
    records = [c for c in resp.json() if c["device_id"] == device.id]
    assert len(records) == 2
    assert {r["granted"] for r in records} == {True, False}


@pytest.mark.asyncio
async def test_my_data_export(client, test_user):
    resp = await client.get("/api/gdpr/my-data")
    assert resp.status_code == 200
    data = resp.json()
    assert data["format"].startswith("chaos-route-gdpr-export/")
    assert data["profile"]["username"] == test_user.username
    assert data["profile"]["email"] == test_user.email
    assert "consents" in data
    assert "tours_driven" in data
    assert "activity_log" in data


@pytest.mark.asyncio
async def test_export_driver_unknown_plate(client):
    resp = await client.get("/api/gdpr/export-driver/", params={"license_plate": "1-ZZZ-999"})
    assert resp.status_code == 404
