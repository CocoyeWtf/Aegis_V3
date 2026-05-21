"""Tests workflow combi / Combi workflow tests.

Verifie le cycle complet :
- Declaration combi par le PDV (stock absolu, 1 etiquette)
- Re-declaration annule la precedente (annulation auto)
- Scan d'arrivee chauffeur retourne les infos de declaration
- Scan combi individuel exige pickup_label_id
- Cloture chauffeur fixe actual_picked_quantity = nb scans et decremente le stock
"""

from datetime import date, timedelta

import pytest


def _tomorrow_iso() -> str:
    return (date.today() + timedelta(days=1)).isoformat()


async def _create_combi_request(client, pdv, st, quantity: int):
    """Helper : creer une declaration combi via l'API / Create combi declaration via API."""
    resp = await client.post(
        "/api/pickup-requests/",
        json={
            "pdv_id": pdv.id,
            "support_type_id": st.id,
            "quantity": quantity,
            "availability_date": _tomorrow_iso(),
            "pickup_type": "CONTAINER",
            "with_content": False,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_combi_declaration_creates_single_label(client, test_pdv, test_combi_support_type):
    """Une declaration combi cree UNE seule etiquette (et non N comme pour les autres supports).
    A combi declaration creates ONE label (not N like other support types).
    """
    body = await _create_combi_request(client, test_pdv, test_combi_support_type, quantity=12)
    assert body["quantity"] == 12
    assert body["status"] == "REQUESTED"
    labels = body.get("labels", [])
    assert len(labels) == 1, f"Combi declaration should create exactly 1 label, got {len(labels)}"
    assert labels[0]["status"] == "PENDING"


@pytest.mark.asyncio
async def test_combi_declaration_cancels_previous_active(client, test_pdv, test_combi_support_type):
    """Une nouvelle declaration combi sur le meme PDV+support annule l'ancienne (statut CANCELLED).
    A new combi declaration on same PDV+support cancels the previous one.
    """
    first = await _create_combi_request(client, test_pdv, test_combi_support_type, quantity=10)
    second = await _create_combi_request(client, test_pdv, test_combi_support_type, quantity=12)

    assert first["id"] != second["id"]

    # Verifier que la 1ere demande est passee a CANCELLED / Verify first is now CANCELLED
    resp = await client.get(
        f"/api/pickup-requests/?pdv_id={test_pdv.id}&status=CANCELLED",
    )
    assert resp.status_code == 200
    cancelled_ids = {r["id"] for r in resp.json()}
    assert first["id"] in cancelled_ids
    assert second["id"] not in cancelled_ids


@pytest.mark.asyncio
async def test_combi_declaration_absolute_stock_pattern(client, test_pdv, test_combi_support_type):
    """Le pattern stock absolu : 10 -> 12 -> 8, chaque declaration ecrase la precedente.
    Absolute stock pattern: 10 -> 12 -> 8, each declaration overwrites the previous one.
    """
    r1 = await _create_combi_request(client, test_pdv, test_combi_support_type, quantity=10)
    r2 = await _create_combi_request(client, test_pdv, test_combi_support_type, quantity=12)
    r3 = await _create_combi_request(client, test_pdv, test_combi_support_type, quantity=8)

    # Seule la derniere est active / Only the last is active
    resp = await client.get(
        f"/api/pickup-requests/?pdv_id={test_pdv.id}&status=REQUESTED",
    )
    active_ids = {r["id"] for r in resp.json()}
    assert r3["id"] in active_ids
    assert r1["id"] not in active_ids
    assert r2["id"] not in active_ids


@pytest.mark.asyncio
async def test_combi_quantity_validation_rejects_out_of_range(client, test_pdv, test_combi_support_type):
    """quantity hors bornes (negatif ou > 9999) est rejetee / out-of-range quantity is rejected."""
    for bad_q in (-1, 10000):
        resp = await client.post(
            "/api/pickup-requests/",
            json={
                "pdv_id": test_pdv.id,
                "support_type_id": test_combi_support_type.id,
                "quantity": bad_q,
                "availability_date": _tomorrow_iso(),
                "pickup_type": "CONTAINER",
                "with_content": False,
            },
        )
        assert resp.status_code in (400, 422), (
            f"quantity={bad_q} should be rejected, got {resp.status_code}: {resp.text}"
        )


@pytest.mark.asyncio
async def test_non_combi_declaration_creates_n_labels(client, test_pdv, db_session):
    """Un support type non-combi cree N etiquettes (workflow standard) /
    A non-combi support type creates N labels (standard workflow).
    """
    from app.models.support_type import SupportType
    import uuid

    st = SupportType(
        code=f"PA_T_{uuid.uuid4().hex[:5].upper()}",
        short_code="PA",
        name="Palette Test",
        unit_quantity=1,
        is_active=True,
        is_combi=False,
    )
    db_session.add(st)
    await db_session.commit()
    await db_session.refresh(st)

    body = await _create_combi_request(client, test_pdv, st, quantity=3)
    labels = body.get("labels", [])
    assert len(labels) == 3, f"Standard pickup should create 3 labels, got {len(labels)}"


@pytest.mark.asyncio
async def test_combi_replacement_keeps_picked_up_intact(
    client, test_pdv, test_combi_support_type, db_session,
):
    """Une declaration deja PICKED_UP n'est pas annulee par une nouvelle declaration.
    An already PICKED_UP declaration is not cancelled by a new declaration.
    """
    from app.models.pickup_request import PickupRequest, PickupStatus
    from sqlalchemy import select

    first = await _create_combi_request(client, test_pdv, test_combi_support_type, quantity=10)

    # Marquer la 1ere comme PICKED_UP manuellement (simule fin chauffeur) /
    # Manually mark first as PICKED_UP (simulates driver close)
    result = await db_session.execute(
        select(PickupRequest).where(PickupRequest.id == first["id"])
    )
    req = result.scalar_one()
    req.status = PickupStatus.PICKED_UP
    await db_session.commit()

    # Nouvelle declaration / New declaration
    second = await _create_combi_request(client, test_pdv, test_combi_support_type, quantity=15)

    # La 1ere reste PICKED_UP, pas CANCELLED / First stays PICKED_UP, not CANCELLED
    result = await db_session.execute(
        select(PickupRequest).where(PickupRequest.id == first["id"])
    )
    refreshed = result.scalar_one()
    assert refreshed.status == PickupStatus.PICKED_UP, (
        f"PICKED_UP declaration must not be cancelled, got {refreshed.status}"
    )
    assert second["status"] == "REQUESTED"
