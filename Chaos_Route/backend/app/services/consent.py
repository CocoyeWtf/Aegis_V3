"""Gestion des consentements / Consent management (STIME A7, action DPIA A3).

État courant d'un consentement = dernière ligne du journal append-only
(app/models/consent_record.py). Utilisé par l'ingestion GPS (opt-out) et les
endpoints RGPD.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent_record import ConsentRecord

# Types de consentement / Consent types
GPS_TRACKING = "gps_tracking"

# Notice d'information géolocalisation (affichée par l'app mobile avant choix).
# Versionnée : chaque consentement enregistre la version affichée.
GPS_PRIVACY_NOTICE_VERSION = "1.0-2026-07"
GPS_PRIVACY_NOTICE = (
    "Suivi GPS des tournées — Information (RGPD)\n\n"
    "Finalité : pendant vos tournées, l'application transmet la position du "
    "véhicule pour le suivi opérationnel en temps réel (avancement, alertes "
    "retard), la preuve de passage et la sécurité.\n\n"
    "Données : position, vitesse, précision, horodatage — uniquement pendant "
    "une tournée assignée. Aucun suivi hors tournée.\n\n"
    "Conservation : positions brutes conservées 60 jours puis supprimées "
    "automatiquement.\n\n"
    "Vos droits : vous pouvez refuser ou retirer votre consentement à tout "
    "moment via le bouton « Confidentialité » de l'écran d'accueil ; le suivi "
    "s'arrête alors immédiatement. Droits d'accès, de rectification et "
    "d'effacement : contactez votre responsable ou le délégué à la protection "
    "des données (coordonnées au registre des traitements)."
)


async def get_latest_consent(
    session: AsyncSession,
    consent_type: str,
    device_id: int | None = None,
    user_id: int | None = None,
) -> ConsentRecord | None:
    """Dernier choix enregistré pour ce sujet / Latest recorded choice, or None."""
    query = select(ConsentRecord).where(ConsentRecord.consent_type == consent_type)
    if device_id is not None:
        query = query.where(ConsentRecord.device_id == device_id)
    if user_id is not None:
        query = query.where(ConsentRecord.user_id == user_id)
    result = await session.execute(query.order_by(ConsentRecord.id.desc()).limit(1))
    return result.scalars().first()


async def record_consent(
    session: AsyncSession,
    consent_type: str,
    granted: bool,
    device_id: int | None = None,
    user_id: int | None = None,
    subject_name: str | None = None,
    info_version: str | None = None,
    source: str | None = None,
) -> ConsentRecord:
    """Journaliser un choix (append-only) / Append a consent choice."""
    record = ConsentRecord(
        consent_type=consent_type,
        granted=granted,
        device_id=device_id,
        user_id=user_id,
        subject_name=subject_name,
        info_version=info_version,
        source=source,
        recorded_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    session.add(record)
    await session.flush()
    return record
