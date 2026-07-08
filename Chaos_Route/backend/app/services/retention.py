"""Purge automatique selon les politiques de rétention / Automatic retention purge.

Remédiation STIME A6 : chaque catégorie de données a une durée définie dans la
table `retention_policies` (voir registre Art. 30) ; ce service purge
quotidiennement les données au-delà de leur durée, et journalise chaque purge
dans l'audit log (traçabilité).

Durées décidées (2026-07) : audit 12 mois (≥ 6 mois garanti), photos 12 mois,
SMS 12 mois, GPS brut 60 jours (norme CNIL géolocalisation — à confirmer).
Les logs applicatifs (stdout Docker) relèvent de l'infra : rotation Docker +
agrégation 6 mois via Loki (action B4).
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.container_anomaly import AnomalyPhoto
from app.models.control_evidence import ControlEvidence
from app.models.driver_declaration import DeclarationPhoto
from app.models.gps_position import GPSPosition
from app.models.retention_policy import RetentionPolicy
from app.models.sms_queue import SmsQueue
from app.models.ticket import TicketPhoto
from app.models.vehicle_inspection import InspectionPhoto

logger = logging.getLogger("chaos_route.retention")

# Rétention minimale des journaux d'audit (exigence STIME : >= 6 mois)
MIN_AUDIT_RETENTION_DAYS = 180

# Politiques par défaut (créées si absentes ; modifiables via l'API superadmin)
DEFAULT_POLICIES = [
    {
        "category": "audit_logs",
        "label": "Journaux d'audit applicatifs (connexions, mutations)",
        "retention_days": 365,
        "legal_basis": "Sécurité / traçabilité — décision 2026-07 : 12 mois (minimum 6 mois)",
    },
    {
        "category": "gps_positions",
        "label": "Positions GPS brutes des chauffeurs",
        "retention_days": 60,
        "legal_basis": "Norme CNIL géolocalisation véhicules : données brutes 2 mois (à confirmer)",
    },
    {
        "category": "sms_messages",
        "label": "SMS envoyés (file passerelle : numéros + contenus)",
        "retention_days": 365,
        "legal_basis": "Preuve de notification — décision 2026-07 : 12 mois",
    },
    {
        "category": "photos",
        "label": "Photos opérationnelles (anomalies, déclarations, inspections, tickets, preuves de contrôle)",
        "retention_days": 365,
        "legal_basis": "Preuve opérationnelle / litiges — décision 2026-07 : 12 mois",
    },
]

# Tables photos : (modèle, colonne date ISO, colonne chemin fichier)
_PHOTO_SOURCES = [
    (AnomalyPhoto, AnomalyPhoto.uploaded_at, AnomalyPhoto.file_path),
    (DeclarationPhoto, DeclarationPhoto.uploaded_at, DeclarationPhoto.file_path),
    (InspectionPhoto, InspectionPhoto.uploaded_at, InspectionPhoto.file_path),
    (TicketPhoto, TicketPhoto.uploaded_at, TicketPhoto.file_path),
    (ControlEvidence, ControlEvidence.scan_date, ControlEvidence.photo_path),
]


async def ensure_default_policies(session: AsyncSession) -> None:
    """Créer les politiques manquantes / Create missing default policies."""
    result = await session.execute(select(RetentionPolicy.category))
    existing = {row[0] for row in result.fetchall()}
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    created = []
    for policy in DEFAULT_POLICIES:
        if policy["category"] not in existing:
            session.add(RetentionPolicy(**policy, updated_at=now))
            created.append(policy["category"])
    if created:
        await session.commit()
        logger.info("Politiques de rétention créées : %s", ", ".join(created))


def _cutoff_iso(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")


def _cutoff_date(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")


def _delete_file(path_str: str | None) -> None:
    """Supprimer le fichier associé, sans échouer la purge / Best-effort file removal."""
    if not path_str:
        return
    try:
        Path(path_str).unlink(missing_ok=True)
    except OSError as exc:
        logger.warning("Fichier non supprimé %s : %s", path_str, exc)


async def _purge_audit_logs(session: AsyncSession, days: int) -> int:
    # Garantie plancher : jamais moins de 6 mois de journaux
    days = max(days, MIN_AUDIT_RETENTION_DAYS)
    result = await session.execute(delete(AuditLog).where(AuditLog.timestamp < _cutoff_iso(days)))
    return result.rowcount or 0


async def _purge_gps_positions(session: AsyncSession, days: int) -> int:
    result = await session.execute(
        delete(GPSPosition).where(GPSPosition.timestamp < _cutoff_iso(days))
    )
    return result.rowcount or 0


async def _purge_sms(session: AsyncSession, days: int) -> int:
    # Ne purge que les messages traités (SENT/FAILED) ; les PENDING restent en file
    result = await session.execute(
        delete(SmsQueue).where(
            SmsQueue.created_at < _cutoff_iso(days),
            SmsQueue.status != "PENDING",
        )
    )
    return result.rowcount or 0


async def _purge_photos(session: AsyncSession, days: int) -> int:
    total = 0
    for model, ts_col, path_col in _PHOTO_SOURCES:
        cutoff = _cutoff_date(days) if model is ControlEvidence else _cutoff_iso(days)
        rows = (await session.execute(
            select(model.id, path_col).where(ts_col < cutoff)
        )).fetchall()
        if not rows:
            continue
        for _, path_str in rows:
            _delete_file(path_str)
        await session.execute(delete(model).where(model.id.in_([r[0] for r in rows])))
        total += len(rows)
    return total


_PURGERS = {
    "audit_logs": _purge_audit_logs,
    "gps_positions": _purge_gps_positions,
    "sms_messages": _purge_sms,
    "photos": _purge_photos,
}


async def run_retention_purge(session: AsyncSession) -> dict[str, int]:
    """Exécuter la purge pour toutes les politiques actives / Run all active purges.

    Retourne le nombre de lignes purgées par catégorie et journalise le
    résultat dans l'audit log.
    """
    result = await session.execute(select(RetentionPolicy).where(RetentionPolicy.is_active))
    policies = result.scalars().all()

    counts: dict[str, int] = {}
    for policy in policies:
        purger = _PURGERS.get(policy.category)
        if purger is None:
            logger.warning("Catégorie de rétention inconnue : %s", policy.category)
            continue
        counts[policy.category] = await purger(session, policy.retention_days)

    # Ménage technique : liste noire des jetons expirés (STIME A4) /
    # Housekeeping: drop revocation entries for expired tokens
    from app.services.token_revocation import purge_expired_revocations
    counts["revoked_tokens_expired"] = await purge_expired_revocations(session)

    # Traçabilité : une entrée d'audit par purge / One audit entry per purge run
    session.add(AuditLog(
        entity_type="retention", entity_id=0, action="RETENTION_PURGE",
        changes=json.dumps(counts, ensure_ascii=False),
        user="system", timestamp=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    ))
    await session.commit()
    logger.info("Purge de rétention exécutée : %s", counts)
    return counts


async def retention_scheduler(interval_hours: int = 24) -> None:
    """Boucle de purge quotidienne (tâche de fond) / Daily purge background loop."""
    from app.database import async_session

    while True:
        try:
            async with async_session() as session:
                await run_retention_purge(session)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Échec de la purge de rétention (nouvelle tentative au prochain cycle)")
        await asyncio.sleep(interval_hours * 3600)
