"""Tests remédiation STIME A6 — politiques de rétention + purge automatique.

Couvre : création des politiques par défaut, purge par catégorie (audit, GPS,
SMS, photos avec suppression fichier), plancher 6 mois sur l'audit, API
superadmin (lecture, modification, purge manuelle) et traçabilité de la purge.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.audit import AuditLog
from app.models.gps_position import GPSPosition
from app.models.retention_policy import RetentionPolicy
from app.models.sms_queue import SmsQueue
from app.models.ticket import Ticket, TicketPhoto
from app.services.retention import (
    MIN_AUDIT_RETENTION_DAYS,
    ensure_default_policies,
    run_retention_purge,
)


def _iso(days_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat(timespec="seconds")


@pytest.mark.asyncio
async def test_default_policies_created(db_session):
    await ensure_default_policies(db_session)
    from sqlalchemy import select

    result = await db_session.execute(select(RetentionPolicy.category))
    categories = {row[0] for row in result.fetchall()}
    assert {"audit_logs", "gps_positions", "sms_messages", "photos"} <= categories

    # Idempotent : pas de doublon au 2e appel
    await ensure_default_policies(db_session)
    result = await db_session.execute(select(RetentionPolicy))
    cats = [p.category for p in result.scalars().all()]
    assert len(cats) == len(set(cats))


@pytest.mark.asyncio
async def test_purge_respects_retention_durations(db_session, tmp_path):
    from sqlalchemy import select

    await ensure_default_policies(db_session)
    marker = uuid.uuid4().hex[:8]

    # Audit : une vieille entrée (2 ans) et une récente
    old_audit = AuditLog(entity_type=f"t_{marker}", entity_id=1, action="CREATE",
                         user="x", timestamp=_iso(730))
    new_audit = AuditLog(entity_type=f"t_{marker}", entity_id=2, action="CREATE",
                         user="x", timestamp=_iso(10))
    # GPS : vieille (90 j > 60 j) et récente
    old_gps = GPSPosition(device_id=999999, tour_id=999999, latitude=50.0,
                          longitude=4.0, timestamp=_iso(90))
    new_gps = GPSPosition(device_id=999999, tour_id=999999, latitude=50.0,
                          longitude=4.0, timestamp=_iso(5))
    # SMS : vieux envoyé (purgé), vieux PENDING (conservé)
    old_sms = SmsQueue(phone="+32470000000", body="test", status="SENT",
                       created_at=_iso(400), sent_at=_iso(400))
    old_pending = SmsQueue(phone="+32470000001", body="test", status="PENDING",
                           created_at=_iso(400))
    # Photo ticket : vieille avec fichier réel → ligne + fichier supprimés
    photo_file = tmp_path / f"photo_{marker}.jpg"
    photo_file.write_bytes(b"fake-jpeg")
    ticket = Ticket(title=f"Ticket {marker}")
    db_session.add(ticket)
    await db_session.flush()
    old_photo = TicketPhoto(ticket_id=ticket.id, filename=photo_file.name,
                            file_path=str(photo_file), uploaded_at=_iso(400))

    db_session.add_all([old_audit, new_audit, old_gps, new_gps, old_sms, old_pending, old_photo])
    await db_session.commit()
    old_audit_id, new_audit_id = old_audit.id, new_audit.id
    old_gps_id, new_gps_id = old_gps.id, new_gps.id
    old_sms_id, pending_id = old_sms.id, old_pending.id
    photo_id = old_photo.id

    counts = await run_retention_purge(db_session)
    assert counts["audit_logs"] >= 1
    assert counts["gps_positions"] >= 1
    assert counts["sms_messages"] >= 1
    assert counts["photos"] >= 1

    async def exists(model, pk) -> bool:
        return (await db_session.execute(select(model).where(model.id == pk))).scalar_one_or_none() is not None

    assert not await exists(AuditLog, old_audit_id)
    assert await exists(AuditLog, new_audit_id)
    assert not await exists(GPSPosition, old_gps_id)
    assert await exists(GPSPosition, new_gps_id)
    assert not await exists(SmsQueue, old_sms_id)
    assert await exists(SmsQueue, pending_id)          # PENDING jamais purgé
    assert not await exists(TicketPhoto, photo_id)
    assert not photo_file.exists()                     # fichier disque supprimé

    # Traçabilité : la purge est journalisée à l'audit
    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == "RETENTION_PURGE").order_by(AuditLog.id.desc())
    )
    entry = result.scalars().first()
    assert entry is not None
    assert json.loads(entry.changes)  # compte par catégorie


@pytest.mark.asyncio
async def test_audit_purge_never_below_six_months(db_session):
    """Même avec une politique agressive, l'audit garde >= 6 mois."""
    from sqlalchemy import select

    await ensure_default_policies(db_session)
    result = await db_session.execute(
        select(RetentionPolicy).where(RetentionPolicy.category == "audit_logs")
    )
    policy = result.scalar_one()
    policy.retention_days = 1  # tentative de purge quasi totale
    await db_session.commit()

    kept = AuditLog(entity_type="floor_test", entity_id=1, action="CREATE",
                    user="x", timestamp=_iso(60))  # 2 mois : dans le plancher
    db_session.add(kept)
    await db_session.commit()
    kept_id = kept.id

    await run_retention_purge(db_session)
    still = (await db_session.execute(
        select(AuditLog).where(AuditLog.id == kept_id)
    )).scalar_one_or_none()
    assert still is not None, "une entrée < 6 mois ne doit jamais être purgée"

    # Restaurer la valeur par défaut pour les autres tests
    policy.retention_days = 365
    await db_session.commit()


@pytest.mark.asyncio
async def test_retention_api(client, db_session):
    await ensure_default_policies(db_session)

    resp = await client.get("/api/retention/")
    assert resp.status_code == 200
    categories = {p["category"] for p in resp.json()}
    assert "audit_logs" in categories

    # Plancher API : impossible de descendre l'audit sous 180 jours
    resp = await client.put("/api/retention/audit_logs", json={"retention_days": 90})
    assert resp.status_code == 400
    assert "180" in resp.json()["detail"]

    # Modification valide + audit de la modification
    resp = await client.put("/api/retention/gps_positions", json={"retention_days": 45})
    assert resp.status_code == 200
    assert resp.json()["retention_days"] == 45

    resp = await client.put("/api/retention/inconnue", json={"retention_days": 10})
    assert resp.status_code == 404

    # Purge manuelle
    resp = await client.post("/api/retention/purge")
    assert resp.status_code == 200
    assert "purged" in resp.json()

    # Restaurer la valeur GPS par défaut
    resp = await client.put("/api/retention/gps_positions", json={"retention_days": 60})
    assert resp.status_code == 200
