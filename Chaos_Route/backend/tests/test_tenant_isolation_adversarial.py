"""Tests ADVERSES d'isolation multi-tenant : le tenant A tente d'atteindre les
données du tenant B par chaque chemin cartographié — l'accès DOIT échouer.

Rejouables en CI. Chaque test échoue si l'isolation régresse.
"""

import pytest


# ─────────────────────────────────────────────────────────────────────────────
# C1 — WebSocket tracking : broadcast cloisonné par tenant
# ─────────────────────────────────────────────────────────────────────────────

class _FakeWS:
    """Faux WebSocket capturant les messages envoyés / Fake WS capturing sends."""
    def __init__(self):
        self.sent: list[str] = []
        self.accepted = False

    async def accept(self):
        self.accepted = True

    async def send_text(self, data: str):
        self.sent.append(data)


@pytest.mark.asyncio
async def test_ws_broadcast_is_tenant_scoped():
    """Un client du tenant B ne doit PAS recevoir un événement du tenant A.
    Un client consolidation (tenant None) reçoit tout. / WS broadcast partitioning."""
    from app.api.ws_tracking import TrackingConnectionManager

    mgr = TrackingConnectionManager()
    ws_a = _FakeWS()      # tenant 1
    ws_b = _FakeWS()      # tenant 2
    ws_admin = _FakeWS()  # consolidation (None) — voit tout
    await mgr.connect(ws_a, tenant_id=1)
    await mgr.connect(ws_b, tenant_id=2)
    await mgr.connect(ws_admin, tenant_id=None)

    # Événement GPS émis pour le tenant 1
    await mgr.broadcast({"type": "gps_update", "tour_code": "T-A", "latitude": 50.0}, tenant_id=1)

    assert len(ws_a.sent) == 1, "le client du tenant émetteur doit recevoir"
    assert len(ws_b.sent) == 0, "FUITE : un client d'un autre tenant a reçu l'événement"
    assert len(ws_admin.sent) == 1, "un client consolidation doit tout recevoir"

    # Événement du tenant 2 : seul B (+ admin) le reçoit
    await mgr.broadcast({"type": "gps_update", "tour_code": "T-B"}, tenant_id=2)
    assert len(ws_a.sent) == 1, "FUITE : le tenant 1 a reçu un événement du tenant 2"
    assert len(ws_b.sent) == 1
    assert len(ws_admin.sent) == 2


@pytest.mark.asyncio
async def test_ws_broadcast_requires_tenant_id():
    """broadcast() SANS tenant_id doit lever (pas de diffusion à tout le monde). /
    Forgetting the tenant is an error, never a silent broadcast-to-all."""
    from app.api.ws_tracking import TrackingConnectionManager
    mgr = TrackingConnectionManager()
    with pytest.raises(TypeError):
        await mgr.broadcast({"type": "x"})  # type: ignore[call-arg]
