"""Tests rendu ZPL/TSPL + historisation impression /
ZPL/TSPL rendering + print event audit tests.
"""

from datetime import date, timedelta

import pytest


def _tomorrow_iso() -> str:
    return (date.today() + timedelta(days=1)).isoformat()


async def _create_pickup(client, pdv, st, quantity: int):
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
async def test_render_zpl_returns_one_per_label(client, test_pdv, db_session):
    """Une demande non-combi de 3 unites -> 3 etiquettes ZPL retournees.
    3-unit non-combi request -> 3 ZPL labels returned.
    """
    import uuid
    from app.models.support_type import SupportType

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

    req = await _create_pickup(client, test_pdv, st, quantity=3)

    resp = await client.post(
        f"/api/pickup-requests/{req['id']}/render-labels?protocol=ZPL",
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["protocol"] == "ZPL"
    assert len(body["labels"]) == 3
    for i, rendered in enumerate(body["labels"], start=1):
        assert rendered["sequence_number"] == i
        assert rendered["payload"].startswith("^XA")
        assert rendered["payload"].endswith("^XZ")
        assert rendered["label_code"] in rendered["payload"]
        # Le code PDV doit etre dans la chaine ZPL /
        # PDV code must be in the ZPL string
        assert test_pdv.code in rendered["payload"]


@pytest.mark.asyncio
async def test_render_tspl_returns_tspl_commands(client, test_pdv, db_session):
    """Une demande retourne du TSPL avec SIZE/CLS/PRINT.
    A request returns TSPL with SIZE/CLS/PRINT commands.
    """
    import uuid
    from app.models.support_type import SupportType

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

    req = await _create_pickup(client, test_pdv, st, quantity=2)

    resp = await client.post(
        f"/api/pickup-requests/{req['id']}/render-labels?protocol=TSPL",
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["protocol"] == "TSPL"
    assert len(body["labels"]) == 2
    for rendered in body["labels"]:
        assert "SIZE" in rendered["payload"]
        assert "CLS" in rendered["payload"]
        assert "PRINT 1" in rendered["payload"]
        assert rendered["label_code"] in rendered["payload"]


@pytest.mark.asyncio
async def test_render_combi_returns_single_label_with_stock_marker(
    client, test_pdv, test_combi_support_type,
):
    """Une declaration combi -> 1 etiquette avec "STOCK COMBI" dans le ZPL.
    Combi declaration -> 1 label with "STOCK COMBI" in ZPL.
    """
    req = await _create_pickup(client, test_pdv, test_combi_support_type, quantity=12)

    resp = await client.post(
        f"/api/pickup-requests/{req['id']}/render-labels?protocol=ZPL",
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["labels"]) == 1
    payload = body["labels"][0]["payload"]
    assert "STOCK COMBI: 12" in payload


@pytest.mark.asyncio
async def test_render_invalid_protocol_returns_400(client, test_pdv, db_session):
    """Protocole non supporte -> 400.
    Unsupported protocol -> 400.
    """
    import uuid
    from app.models.support_type import SupportType

    st = SupportType(
        code=f"PA_T_{uuid.uuid4().hex[:5].upper()}",
        short_code="PA",
        name="Palette Test",
        unit_quantity=1,
        is_active=True,
    )
    db_session.add(st)
    await db_session.commit()
    await db_session.refresh(st)

    req = await _create_pickup(client, test_pdv, st, quantity=1)

    resp = await client.post(
        f"/api/pickup-requests/{req['id']}/render-labels?protocol=EPL",
    )
    assert resp.status_code == 400
    assert "ZPL" in resp.json()["detail"] and "TSPL" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_render_unknown_request_returns_404(client):
    """Demande inexistante -> 404.
    Unknown request -> 404.
    """
    resp = await client.post("/api/pickup-requests/999999/render-labels?protocol=ZPL")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_print_event_creates_audit_and_increments_print_count(
    client, test_pdv, test_combi_support_type, db_session,
):
    """Logger un evenement d'impression cree l'audit et incremente print_count.
    Logging a print event creates the audit record and increments print_count.
    """
    from app.models.label_print_event import LabelPrintEvent
    from app.models.pickup_request import PickupRequest
    from sqlalchemy import select

    req = await _create_pickup(client, test_pdv, test_combi_support_type, quantity=10)
    label_id = req["labels"][0]["id"]

    resp = await client.post(
        "/api/pickup-requests/print-events",
        json={
            "label_ids": [label_id],
            "protocol": "ZPL",
            "source": "MOBILE_PDV",
            "printer_name": "Zebra ZQ320",
            "printer_address": "AA:BB:CC:DD:EE:FF",
            "success": True,
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["events_created"] == 1
    assert body["requests_updated"] == 1

    # Verifier audit en DB / Verify audit in DB
    result = await db_session.execute(
        select(LabelPrintEvent).where(LabelPrintEvent.pickup_label_id == label_id)
    )
    events = result.scalars().all()
    assert len(events) == 1
    assert events[0].printer_name == "Zebra ZQ320"
    assert events[0].success is True

    # Verifier print_count incremente / Verify print_count incremented
    result = await db_session.execute(
        select(PickupRequest).where(PickupRequest.id == req["id"])
    )
    refreshed = result.scalar_one()
    assert refreshed.print_count == 1


@pytest.mark.asyncio
async def test_print_event_failure_does_not_increment_print_count(
    client, test_pdv, test_combi_support_type, db_session,
):
    """Un echec d'impression est trace mais n'incremente pas print_count.
    A print failure is recorded but does not increment print_count.
    """
    from app.models.label_print_event import LabelPrintEvent
    from app.models.pickup_request import PickupRequest
    from sqlalchemy import select

    req = await _create_pickup(client, test_pdv, test_combi_support_type, quantity=5)
    label_id = req["labels"][0]["id"]

    resp = await client.post(
        "/api/pickup-requests/print-events",
        json={
            "label_ids": [label_id],
            "protocol": "ZPL",
            "source": "MOBILE_PDV",
            "success": False,
            "error_detail": "Bluetooth disconnected mid-print",
        },
    )
    assert resp.status_code == 201

    result = await db_session.execute(
        select(LabelPrintEvent).where(LabelPrintEvent.pickup_label_id == label_id)
    )
    events = result.scalars().all()
    assert len(events) == 1
    assert events[0].success is False
    assert events[0].error_detail == "Bluetooth disconnected mid-print"

    result = await db_session.execute(
        select(PickupRequest).where(PickupRequest.id == req["id"])
    )
    refreshed = result.scalar_one()
    assert (refreshed.print_count or 0) == 0


@pytest.mark.asyncio
async def test_print_event_invalid_protocol_returns_400(client, test_pdv, test_combi_support_type):
    """Protocole invalide -> 400.
    Invalid protocol -> 400.
    """
    req = await _create_pickup(client, test_pdv, test_combi_support_type, quantity=1)
    label_id = req["labels"][0]["id"]

    resp = await client.post(
        "/api/pickup-requests/print-events",
        json={
            "label_ids": [label_id],
            "protocol": "ESC/POS",
            "source": "MOBILE_PDV",
        },
    )
    assert resp.status_code == 400
    assert "Protocole" in resp.json()["detail"]
