"""WebSocket temps reel pour suivi chauffeurs / Real-time WebSocket for driver tracking."""

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.utils.auth import decode_token

router = APIRouter()


class TrackingConnectionManager:
    """Gestionnaire de connexions WebSocket / WebSocket connection manager."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Envoyer a tous les clients connectes / Broadcast to all connected clients."""
        data = json.dumps(message, ensure_ascii=False)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(data)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

    async def send_personal(self, websocket: WebSocket, message: dict):
        await websocket.send_text(json.dumps(message, ensure_ascii=False))


# Singleton global / Global singleton
manager = TrackingConnectionManager()


@router.websocket("/ws/tracking")
async def websocket_tracking(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """Connexion WebSocket authentifiee / Authenticated WebSocket connection.

    Types de messages : gps_update, stop_event, alert, tour_status
    """
    # Authentification JWT / JWT authentication
    payload = decode_token(token) if token else None
    if payload is None or payload.get("type") != "access":
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(websocket)
    try:
        while True:
            # Garder la connexion ouverte, recevoir pings / Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
