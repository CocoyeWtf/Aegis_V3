"""API file SMS pour passerelle Termux / SMS queue API for Termux gateway.
Endpoints publics securises par API_KEY (pas de JWT — le telephone Termux n'a pas de session)."""

import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.sms_queue import SmsQueue

router = APIRouter()

# API key partagée entre le serveur et le téléphone Termux
# Définie dans .env : SMS_API_KEY=une_cle_secrete
SMS_API_KEY = os.getenv("SMS_API_KEY", "chaos-sms-default-key-change-me")


def _verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    """Verifier la cle API / Verify API key."""
    if x_api_key != SMS_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _now_iso() -> str:
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("Europe/Brussels")).isoformat(timespec="seconds")


# ─── Endpoints pour Termux gateway ───

@router.get("/pending/")
async def get_pending_sms(
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_api_key),
):
    """Recuperer les SMS en attente / Get pending SMS messages."""
    result = await db.execute(
        select(SmsQueue)
        .where(SmsQueue.status == "PENDING")
        .order_by(SmsQueue.created_at.asc())
        .limit(limit)
    )
    messages = result.scalars().all()
    return [{
        "id": m.id, "phone": m.phone, "body": m.body,
        "booking_id": m.booking_id, "created_at": m.created_at,
        "attempts": m.attempts,
    } for m in messages]


@router.post("/{sms_id}/sent")
async def mark_sms_sent(
    sms_id: int,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_api_key),
):
    """Marquer un SMS comme envoye / Mark SMS as sent."""
    sms = await db.get(SmsQueue, sms_id)
    if not sms:
        raise HTTPException(status_code=404, detail="SMS non trouve")
    sms.status = "SENT"
    sms.sent_at = _now_iso()
    await db.flush()
    return {"ok": True}


@router.post("/{sms_id}/failed")
async def mark_sms_failed(
    sms_id: int,
    data: dict | None = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_api_key),
):
    """Marquer un SMS comme echoue / Mark SMS as failed."""
    sms = await db.get(SmsQueue, sms_id)
    if not sms:
        raise HTTPException(status_code=404, detail="SMS non trouve")
    sms.attempts = (sms.attempts or 0) + 1
    if sms.attempts >= 3:
        sms.status = "FAILED"
    sms.error = (data or {}).get("error", "Unknown error")
    await db.flush()
    return {"ok": True, "status": sms.status, "attempts": sms.attempts}


@router.get("/stats/")
async def sms_stats(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_api_key),
):
    """Stats file SMS / SMS queue stats."""
    from sqlalchemy import func
    result = await db.execute(
        select(SmsQueue.status, func.count(SmsQueue.id))
        .group_by(SmsQueue.status)
    )
    counts = {row[0]: row[1] for row in result}
    return {
        "pending": counts.get("PENDING", 0),
        "sent": counts.get("SENT", 0),
        "failed": counts.get("FAILED", 0),
    }


# ─── Helper pour envoyer un SMS depuis le code backend ───

async def queue_sms(db: AsyncSession, phone: str, body: str, booking_id: int | None = None):
    """Ajouter un SMS a la file / Queue an SMS for sending.
    Normalise le numero (ajoute +32 si pas de prefixe international)."""
    # Nettoyer le numero
    phone = phone.strip().replace(" ", "").replace(".", "").replace("/", "")
    if phone.startswith("0") and not phone.startswith("00"):
        phone = "+32" + phone[1:]  # Belgique par defaut
    elif phone.startswith("00"):
        phone = "+" + phone[2:]
    elif not phone.startswith("+"):
        phone = "+32" + phone

    sms = SmsQueue(
        phone=phone, body=body, booking_id=booking_id,
        status="PENDING", created_at=_now_iso(), attempts=0,
    )
    db.add(sms)
    await db.flush()
    return sms
