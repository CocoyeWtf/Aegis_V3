"""WebSocket temps reel pour suivi chauffeurs / Real-time WebSocket for driver tracking.

CLOISONNEMENT TENANT : chaque connexion est etiquetee avec le tenant de
l'utilisateur authentifie. `broadcast()` exige le tenant de la donnee emise et ne
diffuse qu'aux connexions du MEME tenant (les clients consolidation/superadmin,
tenant=None, recoivent tout). Oublier le tenant a l'emission est une ERREUR de
signature, pas une fuite silencieuse. / Tenant-partitioned real-time tracking.
"""

import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.api.deps import get_user_tenant_id
from app.database import async_session
from app.models.user import User
from app.utils.auth import decode_token

router = APIRouter()


class TrackingConnectionManager:
    """Gestionnaire de connexions WebSocket cloisonne par tenant / Tenant-scoped manager."""

    def __init__(self):
        # (websocket, tenant_id) ; tenant_id=None => consolidation/superadmin (recoit tout)
        self.active_connections: list[tuple[WebSocket, int | None]] = []

    async def connect(self, websocket: WebSocket, tenant_id: int | None):
        await websocket.accept()
        self.active_connections.append((websocket, tenant_id))

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [
            (ws, t) for (ws, t) in self.active_connections if ws is not websocket
        ]

    async def broadcast(self, message: dict, tenant_id: int | None):
        """Diffuser aux clients du tenant `tenant_id` (celui de la donnee emise).

        - Un client consolidation (tenant None) recoit TOUT.
        - Un client scope a un tenant ne recoit QUE les donnees de son tenant.
        - Une donnee au tenant inconnu (None) ne part qu'aux clients consolidation.
        `tenant_id` est OBLIGATOIRE : il n'y a pas de diffusion "a tout le monde".
        """
        data = json.dumps(message, ensure_ascii=False)
        disconnected: list[WebSocket] = []
        for connection, conn_tenant in self.active_connections:
            # Cloisonnement : un client scope ne voit que son tenant.
            if conn_tenant is not None and conn_tenant != tenant_id:
                continue
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
    """Connexion WebSocket authentifiee et cloisonnee par tenant.

    Types de messages : gps_update, stop_event, alert, tour_status.
    Le tenant du client est resolu depuis l'utilisateur du JWT (comme get_current_user)
    et sert de filtre a la reception.
    """
    # Authentification JWT / JWT authentication
    payload = decode_token(token) if token else None
    if payload is None or payload.get("type") != "access":
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Resoudre le tenant du client (None = consolidation/superadmin -> voit tout) /
    # Resolve the client's tenant (None = consolidation/superadmin -> sees all).
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError, TypeError):
        await websocket.close(code=4001, reason="Invalid token")
        return

    async with async_session() as db:
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if user is None or not user.is_active:
            await websocket.close(code=4001, reason="User not found or inactive")
            return
        tenant_id = get_user_tenant_id(user)

    await manager.connect(websocket, tenant_id)
    try:
        while True:
            # Garder la connexion ouverte, recevoir pings / Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
