"""Audit généralisé de toutes les mutations ORM / Generic ORM mutation audit (STIME A5).

Toute création/modification/suppression d'un modèle métier produit une entrée
`audit_logs`, au niveau de la couche données (événements SQLAlchemy) : les
59 modules sont couverts mécaniquement, sans décorateur par endpoint.

- Acteur : `session.info["actor"]` (positionné par get_current_user /
  get_authenticated_device) ; « system » pour les tâches internes (seed, purge).
- Tenant : l'entrée d'audit hérite du tenant de l'objet muté (sinon du tenant
  de session), donc reste cloisonnée comme le reste de l'audit.
- Champs sensibles (mots de passe, secrets) jamais journalisés ; valeurs
  tronquées à 200 caractères (minimisation).
- Les diffs UPDATE sont capturés en before_flush (l'historique d'attributs est
  vidé par le flush) ; les CREATE en after_flush (l'id n'existe qu'après).

Limites connues : les UPDATE/DELETE en masse (`session.execute(update(...))`)
ne passent pas par le flush ORM — les imports en mode « replace » journalisent
déjà leur propre trace (import_manifest). La rétention des entrées est gérée
par la purge A6 (12 mois, plancher 6 mois).
"""

import json
from datetime import datetime, timezone

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.models.audit import AuditLog

# Tables jamais auditées : le journal lui-même (récursion), les flux à très
# haut volume qui sont leur propre trace, et les contenus SMS (données perso).
EXCLUDED_TABLES = {
    "audit_logs",
    "gps_positions",
    "sms_queue",
}

# Champs jamais inclus dans les diffs / Fields never included in diffs
SENSITIVE_FIELDS = {"hashed_password", "password", "secret", "totp_secret", "token"}

MAX_VALUE_LEN = 200

_PENDING_KEY = "_pending_audit_rows"
_DISABLE_KEY = "audit_trail_disabled"


def _truncate(value) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text if len(text) <= MAX_VALUE_LEN else text[:MAX_VALUE_LEN] + "…"


def _is_auditable(obj) -> bool:
    table = getattr(obj, "__tablename__", None)
    return table is not None and table not in EXCLUDED_TABLES and not isinstance(obj, AuditLog)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _base_row(session: Session, obj, action: str, changes: dict | None) -> dict:
    return {
        "entity_type": obj.__tablename__,
        "entity_id": getattr(obj, "id", None) or 0,
        "action": action,
        "changes": json.dumps(changes, ensure_ascii=False) if changes else None,
        "user": session.info.get("actor", "system"),
        "timestamp": _now(),
        "tenant_id": getattr(obj, "tenant_id", None) or session.info.get("tenant_id"),
    }


@event.listens_for(Session, "before_flush")
def _capture_updates_and_deletes(session: Session, flush_context, instances) -> None:
    """Capturer les diffs UPDATE et les DELETE avant que le flush n'efface l'historique."""
    if session.info.get(_DISABLE_KEY):
        return
    pending = session.info.setdefault(_PENDING_KEY, [])

    for obj in session.dirty:
        if not _is_auditable(obj) or not session.is_modified(obj, include_collections=False):
            continue
        changes: dict = {}
        state = inspect(obj)
        for attr in state.mapper.column_attrs:
            if attr.key in SENSITIVE_FIELDS:
                continue
            history = state.attrs[attr.key].history
            if history.has_changes():
                old = history.deleted[0] if history.deleted else None
                new = history.added[0] if history.added else None
                changes[attr.key] = [_truncate(old), _truncate(new)]
        if changes:
            pending.append(_base_row(session, obj, "UPDATE", changes))

    for obj in session.deleted:
        if _is_auditable(obj):
            pending.append(_base_row(session, obj, "DELETE", None))


@event.listens_for(Session, "after_flush")
def _capture_creates_and_write(session: Session, flush_context) -> None:
    """Capturer les CREATE (id désormais assigné) et écrire toutes les entrées."""
    if session.info.get(_DISABLE_KEY):
        return
    pending = session.info.pop(_PENDING_KEY, [])

    for obj in session.new:
        if not _is_auditable(obj):
            continue
        state = inspect(obj)
        values = {}
        for attr in state.mapper.column_attrs:
            if attr.key in SENSITIVE_FIELDS or attr.key == "id":
                continue
            value = getattr(obj, attr.key, None)
            if value is not None:
                values[attr.key] = _truncate(value)
        pending.append(_base_row(session, obj, "CREATE", values))

    if pending:
        # En after_flush, on écrit via la connexion du flush (même transaction) ;
        # session.execute est proscrit pendant le flush. / Write through the
        # flush connection (same transaction); session.execute is off-limits here.
        session.connection().execute(AuditLog.__table__.insert(), pending)
