"""Onboarding tenant France — idempotent.

But / Goal :
  1. Créer (si absent) le tenant France (code 'FR').
  2. Créer (si absent) le pays France et la région 'Hauts-de-France'.
  3. Rattacher TOUS les utilisateurs au tenant Belgique (id=1)
     SAUF les superadmins nommés (accès tous tenants).
  4. Promouvoir les superadmins nommés (is_superadmin=TRUE).

Sûr par conception :
  - Mode DRY-RUN par défaut : n'écrit RIEN. Ajouter --apply pour écrire.
  - Idempotent : relançable sans effet de bord.
  - Refuse d'agir si un superadmin demandé est introuvable ou ambigu
    (sauf --force, qui ignore seulement les comptes introuvables).
  - Ne RÉTROGRADE jamais automatiquement un autre superadmin existant :
    il est SIGNALÉ pour décision manuelle.

Usage :
    cd backend
    python -m scripts.onboard_france \
        --superadmin dvn.itdev@gmail.com \
        --superadmin estelle.garnier@example.com
    # vérifier le rapport, puis :
    python -m scripts.onboard_france --superadmin ... --superadmin ... --apply

Le matching d'un superadmin se fait sur email OU username (insensible à la casse).
"""

import argparse
import asyncio

from sqlalchemy import text

from app.database import _is_sqlite, engine

BELGIUM_TENANT_ID = 1
FRANCE_TENANT_CODE = "FR"
FRANCE_TENANT_NAME = "France"
FRANCE_COUNTRY_NAME = "France"
FRANCE_COUNTRY_CODE = "FR"  # cohérent avec l'existant ('BE'), Country.code = String(3)
FRANCE_REGION_NAME = "Hauts-de-France"

TRUE = "1" if _is_sqlite else "TRUE"


def _log(msg: str) -> None:
    print(msg, flush=True)


async def resolve_superadmins(conn, identifiers: list[str], force: bool) -> list[int]:
    """Résout les identifiants (email/username) en user.id. Refuse si introuvable/ambigu."""
    resolved: list[int] = []
    fatal = False
    for ident in identifiers:
        rows = (await conn.execute(
            text("SELECT id, username, email FROM users "
                 "WHERE lower(email) = lower(:v) OR lower(username) = lower(:v)"),
            {"v": ident},
        )).fetchall()
        if len(rows) == 1:
            uid, uname, email = rows[0]
            _log(f"  superadmin OK : {ident} -> id={uid} ({uname} / {email})")
            resolved.append(uid)
        elif len(rows) == 0:
            _log(f"  superadmin INTROUVABLE : {ident}")
            if not force:
                fatal = True
        else:
            _log(f"  superadmin AMBIGU : {ident} -> {len(rows)} comptes {[r[0] for r in rows]}")
            fatal = True  # l'ambiguïté n'est jamais ignorée
    if fatal:
        raise SystemExit(
            "ABANDON : un superadmin est introuvable ou ambigu. "
            "Corrige les identifiants (ou --force pour ignorer les introuvables). "
            "Aucune écriture effectuée."
        )
    return resolved


async def ensure_tenant_france(conn, apply: bool) -> int:
    row = (await conn.execute(
        text("SELECT id, name FROM tenants WHERE code = :c"),
        {"c": FRANCE_TENANT_CODE},
    )).fetchone()
    if row:
        _log(f"[tenant] France déjà présent : id={row[0]} ({row[1]})")
        return row[0]
    _log(f"[tenant] France ABSENT -> à créer (code={FRANCE_TENANT_CODE}, name={FRANCE_TENANT_NAME})")
    if apply:
        await conn.execute(
            text(f"INSERT INTO tenants (code, name, is_active) "
                 f"VALUES (:c, :n, {TRUE})"),
            {"c": FRANCE_TENANT_CODE, "n": FRANCE_TENANT_NAME},
        )
        nid = (await conn.execute(
            text("SELECT id FROM tenants WHERE code = :c"), {"c": FRANCE_TENANT_CODE}
        )).fetchone()[0]
        _log(f"[tenant] France créé : id={nid}")
        return nid
    return -1


async def ensure_country_france(conn, apply: bool) -> int:
    row = (await conn.execute(
        text("SELECT id, name, code FROM countries "
             "WHERE lower(name) = lower(:n) OR upper(code) IN ('FR','FRA')"),
        {"n": FRANCE_COUNTRY_NAME},
    )).fetchone()
    if row:
        _log(f"[pays] France déjà présent : id={row[0]} ({row[1]} / {row[2]})")
        return row[0]
    _log(f"[pays] France ABSENT -> à créer (name={FRANCE_COUNTRY_NAME}, code={FRANCE_COUNTRY_CODE})")
    if apply:
        await conn.execute(
            text("INSERT INTO countries (name, code) VALUES (:n, :c)"),
            {"n": FRANCE_COUNTRY_NAME, "c": FRANCE_COUNTRY_CODE},
        )
        cid = (await conn.execute(
            text("SELECT id FROM countries WHERE lower(name) = lower(:n)"),
            {"n": FRANCE_COUNTRY_NAME},
        )).fetchone()[0]
        _log(f"[pays] France créé : id={cid}")
        return cid
    return -1


async def ensure_region_hdf(conn, apply: bool, country_id: int) -> None:
    if country_id == -1:
        _log("[region] Hauts-de-France : (dry-run) dépend de la création du pays France")
        return
    row = (await conn.execute(
        text("SELECT id FROM regions WHERE lower(name) = lower(:n) AND country_id = :cid"),
        {"n": FRANCE_REGION_NAME, "cid": country_id},
    )).fetchone()
    if row:
        _log(f"[region] Hauts-de-France déjà présente : id={row[0]} (country_id={country_id})")
        return
    _log(f"[region] Hauts-de-France ABSENTE -> à créer (country_id={country_id})")
    if apply:
        await conn.execute(
            text("INSERT INTO regions (name, country_id) VALUES (:n, :cid)"),
            {"n": FRANCE_REGION_NAME, "cid": country_id},
        )
        _log("[region] Hauts-de-France créée")


async def assign_users(conn, apply: bool, superadmin_ids: list[int]) -> None:
    # 1) Signaler les superadmins existants NON désirés (jamais rétrogradés auto)
    existing = (await conn.execute(
        text(f"SELECT id, username, email FROM users WHERE is_superadmin = {TRUE}")
    )).fetchall()
    unexpected = [r for r in existing if r[0] not in superadmin_ids]
    if unexpected:
        _log("[users] ATTENTION superadmins existants HORS liste (NON modifiés, à décider) :")
        for r in unexpected:
            _log(f"    - id={r[0]} {r[1]} / {r[2]}")

    # 2) Tous -> tenant Belgique sauf les superadmins nommés
    ids = ",".join(str(i) for i in superadmin_ids) or "-1"
    to_be = (await conn.execute(
        text(f"SELECT count(*) FROM users WHERE id NOT IN ({ids}) "
             f"AND (tenant_id IS NULL OR tenant_id <> :be)"),
        {"be": BELGIUM_TENANT_ID},
    )).fetchone()[0]
    _log(f"[users] {to_be} utilisateur(s) à (re)positionner sur tenant Belgique (id={BELGIUM_TENANT_ID})")
    if apply:
        r = await conn.execute(
            text(f"UPDATE users SET tenant_id = :be WHERE id NOT IN ({ids})"),
            {"be": BELGIUM_TENANT_ID},
        )
        _log(f"[users] {r.rowcount} ligne(s) mises sur tenant Belgique")

    # 3) Promotion superadmin pour les comptes nommés
    if superadmin_ids:
        already = (await conn.execute(
            text(f"SELECT count(*) FROM users WHERE id IN ({ids}) AND is_superadmin = {TRUE}")
        )).fetchone()[0]
        _log(f"[users] superadmins ciblés : {len(superadmin_ids)} ({already} déjà superadmin)")
        if apply:
            r = await conn.execute(
                text(f"UPDATE users SET is_superadmin = {TRUE} WHERE id IN ({ids})")
            )
            _log(f"[users] {r.rowcount} compte(s) promus/confirmés superadmin")


async def main() -> None:
    ap = argparse.ArgumentParser(description="Onboarding tenant France (idempotent)")
    ap.add_argument("--superadmin", action="append", default=[],
                    help="email ou username d'un superadmin (répétable)")
    ap.add_argument("--apply", action="store_true", help="écrire (sinon dry-run)")
    ap.add_argument("--force", action="store_true",
                    help="ignorer les superadmins introuvables (jamais les ambigus)")
    args = ap.parse_args()

    if not args.superadmin:
        raise SystemExit("Préciser au moins un --superadmin (email/username).")

    mode = "APPLY (écriture)" if args.apply else "DRY-RUN (aucune écriture)"
    _log(f"=== Onboarding France — {mode} ===")

    async with engine.begin() as conn:
        _log("\n-- Résolution des superadmins --")
        sa_ids = await resolve_superadmins(conn, args.superadmin, args.force)

        _log("\n-- Référentiel France --")
        await ensure_tenant_france(conn, args.apply)
        country_id = await ensure_country_france(conn, args.apply)
        await ensure_region_hdf(conn, args.apply, country_id)

        _log("\n-- Affectation des utilisateurs --")
        await assign_users(conn, args.apply, sa_ids)

        if not args.apply:
            _log("\n(DRY-RUN) Rien n'a été écrit. Relancer avec --apply pour appliquer.")

    await engine.dispose()
    _log("\n=== Terminé ===")


if __name__ == "__main__":
    asyncio.run(main())
