"""RGPD — Purge et anonymisation des données personnelles / GDPR — Personal data purge and anonymization.

Données personnelles dans le module booking:
- BookingCheckin: license_plate, phone_number, driver_name
- SmsQueue: phone, body (peut contenir des noms)
- Booking: supplier_name (nom commercial, pas perso — conservé)

Politique de retention:
- Données chauffeurs (plaques, tel, noms) : 90 jours après COMPLETED
- SMS : 30 jours après envoi
- Bookings eux-mêmes : conservés (données commerciales)
"""

import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.reception_booking import Booking, BookingCheckin, BookingStatus
from app.models.sms_queue import SmsQueue
from app.models.user import User
from app.models.audit import AuditLog
from app.api.deps import require_permission

router = APIRouter()


def _now_iso() -> str:
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("Europe/Brussels")).isoformat(timespec="seconds")


@router.post("/purge-personal-data/")
async def purge_personal_data(
    days_retention: int = 90,
    dry_run: bool = True,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("parameters", "delete")),
):
    """Anonymiser les donnees personnelles des bookings termines depuis plus de N jours.
    RGPD : droit a l'oubli / Anonymize personal data from bookings completed more than N days ago."""
    from zoneinfo import ZoneInfo
    cutoff = (datetime.now(ZoneInfo("Europe/Brussels")) - timedelta(days=days_retention)).strftime("%Y-%m-%d")

    # Trouver les checkins a anonymiser / Find checkins to anonymize
    result = await db.execute(
        select(BookingCheckin).join(Booking).where(
            Booking.status.in_([BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REFUSED]),
            Booking.booking_date < cutoff,
            BookingCheckin.license_plate != "***",  # Pas deja anonymise
        )
    )
    checkins = result.scalars().all()

    # Trouver les SMS a purger / Find SMS to purge
    sms_cutoff = (datetime.now(ZoneInfo("Europe/Brussels")) - timedelta(days=30)).isoformat()
    sms_result = await db.execute(
        select(SmsQueue).where(
            SmsQueue.status == "SENT",
            SmsQueue.sent_at < sms_cutoff,
        )
    )
    sms_to_purge = sms_result.scalars().all()

    if dry_run:
        return {
            "dry_run": True,
            "checkins_to_anonymize": len(checkins),
            "sms_to_purge": len(sms_to_purge),
            "cutoff_date": cutoff,
            "message": "Aucune donnee modifiee. Relancer avec dry_run=false pour executer.",
        }

    # Anonymiser les checkins / Anonymize checkins
    for ci in checkins:
        ci.license_plate = "***"
        ci.phone_number = "***"
        ci.driver_name = None

    # Purger les SMS / Purge SMS
    for sms in sms_to_purge:
        sms.phone = "***"
        sms.body = "[purge RGPD]"

    await db.flush()

    # Audit log
    db.add(AuditLog(
        entity_type="gdpr",
        entity_id=0,
        action="PURGE_PERSONAL_DATA",
        changes=json.dumps({
            "checkins_anonymized": len(checkins),
            "sms_purged": len(sms_to_purge),
            "retention_days": days_retention,
            "cutoff_date": cutoff,
        }, ensure_ascii=False),
        user=user.username,
        timestamp=_now_iso(),
    ))
    await db.flush()

    return {
        "dry_run": False,
        "checkins_anonymized": len(checkins),
        "sms_purged": len(sms_to_purge),
        "cutoff_date": cutoff,
    }


@router.post("/forget-driver/")
async def forget_driver(
    license_plate: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("parameters", "delete")),
):
    """Droit a l'oubli — supprimer toutes les donnees d'un chauffeur par plaque.
    RGPD Art. 17 / Right to be forgotten — erase all driver data by plate."""
    result = await db.execute(
        select(BookingCheckin).where(BookingCheckin.license_plate == license_plate)
    )
    checkins = result.scalars().all()

    if not checkins:
        raise HTTPException(status_code=404, detail="Aucune donnee trouvee pour cette plaque")

    count = 0
    for ci in checkins:
        ci.license_plate = "***"
        ci.phone_number = "***"
        ci.driver_name = None
        count += 1

    # Purger les SMS associes / Purge associated SMS
    booking_ids = [ci.booking_id for ci in checkins]
    sms_result = await db.execute(
        select(SmsQueue).where(SmsQueue.booking_id.in_(booking_ids))
    )
    for sms in sms_result.scalars().all():
        sms.phone = "***"
        sms.body = "[purge RGPD]"

    await db.flush()

    db.add(AuditLog(
        entity_type="gdpr",
        entity_id=0,
        action="FORGET_DRIVER",
        changes=json.dumps({"plate": license_plate, "checkins_erased": count}, ensure_ascii=False),
        user=user.username,
        timestamp=_now_iso(),
    ))
    await db.flush()

    return {"ok": True, "checkins_erased": count, "plate": license_plate}


@router.get("/data-inventory/")
async def data_inventory(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("parameters", "read")),
):
    """Registre de traitement RGPD — inventaire des donnees personnelles.
    RGPD Art. 30 / Processing registry — personal data inventory."""
    from sqlalchemy import func

    # Compter les checkins avec donnees personnelles
    ci_count = (await db.execute(
        select(func.count(BookingCheckin.id)).where(BookingCheckin.license_plate != "***")
    )).scalar() or 0

    ci_anonymized = (await db.execute(
        select(func.count(BookingCheckin.id)).where(BookingCheckin.license_plate == "***")
    )).scalar() or 0

    sms_count = (await db.execute(
        select(func.count(SmsQueue.id)).where(SmsQueue.phone != "***")
    )).scalar() or 0

    sms_purged = (await db.execute(
        select(func.count(SmsQueue.id)).where(SmsQueue.phone == "***")
    )).scalar() or 0

    return {
        "personal_data_categories": [
            {
                "category": "Donnees chauffeurs (checkins)",
                "fields": ["license_plate", "phone_number", "driver_name"],
                "active_records": ci_count,
                "anonymized_records": ci_anonymized,
                "retention_policy": "90 jours apres fin du booking",
                "legal_basis": "Interet legitime — gestion logistique reception",
            },
            {
                "category": "SMS envoyes",
                "fields": ["phone", "body"],
                "active_records": sms_count,
                "purged_records": sms_purged,
                "retention_policy": "30 jours apres envoi",
                "legal_basis": "Interet legitime — notification numero de quai",
            },
        ],
        "data_processor": "Heberge sur Hostinger (EU), Docker container",
        "dpo_contact": "A definir",
    }
