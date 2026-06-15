"""Tests board de tickets / Ticket board tests."""

import pytest


@pytest.mark.asyncio
async def test_ticket_full_flow(client):
    # Créer un ticket avec contexte
    payload = {
        "title": "Bouton export ne répond pas",
        "description": "Rien ne se passe au clic.",
        "ticket_type": "BUG",
        "priority": "HIGH",
        "context": {"route": "/ordonnancement", "app_version": "1.0.0", "breadcrumb": ["/tours", "/ordonnancement"]},
    }
    resp = await client.post("/api/tickets/", json=payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    tid = body["id"]
    assert body["status"] == "OPEN"
    assert body["title"] == payload["title"]
    # Contexte sérialisé + événement système d'ouverture
    assert body["context"] and "ordonnancement" in body["context"]
    assert any(c["is_system"] for c in body["comments"])

    # Liste transparente (tout le monde voit) + compteur
    resp = await client.get("/api/tickets/")
    assert resp.status_code == 200
    listed = [t for t in resp.json() if t["id"] == tid]
    assert listed and listed[0]["comment_count"] >= 1

    # Ajouter un échange
    resp = await client.post(f"/api/tickets/{tid}/comments", json={"body": "Je confirme le souci."})
    assert resp.status_code == 201
    assert resp.json()["is_system"] is False

    # Changer le statut -> tracé comme événement système
    resp = await client.put(f"/api/tickets/{tid}/status", json={"status": "IN_PROGRESS"})
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["status"] == "IN_PROGRESS"
    sys_events = [c for c in detail["comments"] if c["is_system"]]
    assert any("IN_PROGRESS" in c["body"] for c in sys_events)


@pytest.mark.asyncio
async def test_status_change_no_op_when_same(client):
    resp = await client.post("/api/tickets/", json={"title": "T", "ticket_type": "QUESTION"})
    tid = resp.json()["id"]
    before = len(resp.json()["comments"])
    # Même statut -> pas de nouvel événement
    resp = await client.put(f"/api/tickets/{tid}/status", json={"status": "OPEN"})
    assert resp.status_code == 200
    assert len(resp.json()["comments"]) == before
