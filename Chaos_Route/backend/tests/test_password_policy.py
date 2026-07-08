"""Tests remédiation STIME A1/A2 — politique de mot de passe + seed superadmin.

Couvre :
- la fonction centrale validate_password_strength (longueur, classes, liste noire,
  exigence renforcée pour comptes privilégiés) ;
- le refus de démarrage du seed sans ADMIN_PASSWORD ou avec un mot de passe faible ;
- le branchement de la politique sur les 5 flux (UserCreate, UserUpdate,
  ChangePassword, ResetPassword, seed) ;
- la rotation forcée du mot de passe au 1er login (must_change_password).
"""

import uuid

import pytest
import pytest_asyncio

from app.config import settings
from app.utils.password_policy import (
    MIN_LENGTH,
    MIN_LENGTH_PRIVILEGED,
    PasswordPolicyError,
    validate_password_strength,
)

STRONG = "Fjord!Piano#2026"          # 16 car., 4 classes / 16 chars, 4 classes
STRONG_13 = "Fjord!Piano#2"          # 13 car. : ok standard, trop court privilégié
WEAK_SHORT = "Ab1!Ab1!Ab1"           # 11 car.
WEAK_CLASSES = "abcdefghijklmnop"    # 16 car. mais 1 seule classe


# ---------------------------------------------------------------------------
# Unitaires — validate_password_strength
# ---------------------------------------------------------------------------

def test_policy_accepts_strong_password():
    assert validate_password_strength(STRONG) == STRONG


def test_policy_rejects_short_password():
    with pytest.raises(PasswordPolicyError, match=str(MIN_LENGTH)):
        validate_password_strength(WEAK_SHORT)


def test_policy_rejects_missing_classes():
    with pytest.raises(PasswordPolicyError, match="3 types"):
        validate_password_strength(WEAK_CLASSES)


def test_policy_rejects_common_passwords():
    # « Motdepasse2026! » = mot courant + suffixe trivial → refusé
    with pytest.raises(PasswordPolicyError, match="courant"):
        validate_password_strength("Motdepasse2026!")
    with pytest.raises(PasswordPolicyError, match="courant"):
        validate_password_strength("ChaosRoute#2026!")


def test_policy_privileged_requires_14_chars():
    with pytest.raises(PasswordPolicyError, match=str(MIN_LENGTH_PRIVILEGED)):
        validate_password_strength(STRONG_13, privileged=True)
    assert validate_password_strength(STRONG, privileged=True) == STRONG


# ---------------------------------------------------------------------------
# Seed superadmin (A1) — base dédiée vide
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def empty_db_session(tmp_path):
    """Session sur une base vierge dédiée (la base partagée contient des users)."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    import app.main  # noqa: F401 — charge tous les modèles / loads all models
    from app.database import Base

    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'seed.db').as_posix()}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_seed_refuses_empty_admin_password(empty_db_session, monkeypatch):
    from app.utils.seed import seed_superadmin

    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "")
    with pytest.raises(RuntimeError, match="ADMIN_PASSWORD"):
        await seed_superadmin(empty_db_session)


@pytest.mark.asyncio
async def test_seed_refuses_weak_admin_password(empty_db_session, monkeypatch):
    from app.utils.seed import seed_superadmin

    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "admin")
    with pytest.raises(RuntimeError, match="politique"):
        await seed_superadmin(empty_db_session)

    # 13 caractères : refusé pour un compte privilégié (14 minimum)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", STRONG_13)
    with pytest.raises(RuntimeError, match="politique"):
        await seed_superadmin(empty_db_session)


@pytest.mark.asyncio
async def test_seed_creates_admin_with_forced_rotation(empty_db_session, monkeypatch):
    from sqlalchemy import select

    from app.models.user import User
    from app.utils.auth import verify_password
    from app.utils.seed import seed_superadmin

    monkeypatch.setattr(settings, "ADMIN_USERNAME", "chaos_admin")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", STRONG)
    await seed_superadmin(empty_db_session)

    result = await empty_db_session.execute(select(User))
    admin = result.scalar_one()
    assert admin.username == "chaos_admin"
    assert admin.is_superadmin is True
    assert admin.must_change_password is True
    assert verify_password(STRONG, admin.hashed_password)

    # Seed idempotent : un 2e appel ne crée rien même sans ADMIN_PASSWORD
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "")
    await seed_superadmin(empty_db_session)


# ---------------------------------------------------------------------------
# Flux API (client avec bypass auth) — UserCreate / UserUpdate / Change / Reset
# ---------------------------------------------------------------------------

def _user_payload(password: str, **extra) -> dict:
    sfx = uuid.uuid4().hex[:8]
    return {
        "username": f"pwd_{sfx}",
        "email": f"pwd-{sfx}@chaos-route.app",
        "password": password,
        **extra,
    }


@pytest.mark.asyncio
async def test_user_create_rejects_weak_password(client):
    resp = await client.post("/api/users/", json=_user_payload(WEAK_SHORT))
    assert resp.status_code == 422
    assert "12" in str(resp.json())


@pytest.mark.asyncio
async def test_user_create_superadmin_requires_14_chars(client):
    resp = await client.post("/api/users/", json=_user_payload(STRONG_13, is_superadmin=True))
    assert resp.status_code == 422

    resp = await client.post("/api/users/", json=_user_payload(STRONG, is_superadmin=True))
    assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_user_create_accepts_strong_password(client):
    resp = await client.post("/api/users/", json=_user_payload(STRONG))
    assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_user_update_rejects_weak_password(client):
    created = await client.post("/api/users/", json=_user_payload(STRONG))
    user_id = created.json()["id"]

    resp = await client.put(f"/api/users/{user_id}", json={"password": WEAK_CLASSES})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_user_update_superadmin_target_requires_14_chars(client):
    created = await client.post("/api/users/", json=_user_payload(STRONG, is_superadmin=True))
    user_id = created.json()["id"]

    # Cible superadmin : 13 caractères refusés même si le payload ne porte pas is_superadmin
    resp = await client.put(f"/api/users/{user_id}", json={"password": STRONG_13})
    assert resp.status_code == 400
    assert "14" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_change_password_rejects_weak_password(client):
    resp = await client.put(
        "/api/auth/change-password",
        json={"current_password": "whatever", "new_password": WEAK_SHORT},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_reset_password_rejects_weak_password(client):
    resp = await client.post(
        "/api/auth/reset-password",
        json={"token": "irrelevant", "new_password": "azerty"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Rotation forcée au 1er login (A1) — flux réel JWT, sans bypass auth
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def raw_client():
    """Client sans override d'auth (JWT réel) et sans rate limit."""
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    app.state.limiter.enabled = False
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.state.limiter.enabled = True


@pytest.mark.asyncio
async def test_forced_rotation_flow(raw_client, db_session):
    from app.models.user import User
    from app.utils.auth import hash_password

    sfx = uuid.uuid4().hex[:8]
    initial_pwd = f"Init!Rotation#{sfx}"
    user = User(
        username=f"seeded_{sfx}",
        email=f"seeded-{sfx}@chaos.test",
        hashed_password=hash_password(initial_pwd),
        is_active=True,
        is_superadmin=True,
        must_change_password=True,
    )
    db_session.add(user)
    await db_session.commit()

    # Login : OK mais signale la rotation obligatoire
    resp = await raw_client.post(
        "/api/auth/login", json={"username": user.username, "password": initial_pwd}
    )
    assert resp.status_code == 200, resp.text
    tokens = resp.json()
    assert tokens["must_change_password"] is True
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Tout endpoint métier est bloqué tant que le mot de passe n'est pas changé
    resp = await raw_client.get("/api/users/", headers=headers)
    assert resp.status_code == 403
    assert "mot de passe" in resp.json()["detail"].lower()

    # /me et /change-password restent accessibles
    resp = await raw_client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["must_change_password"] is True

    new_pwd = f"Nouveau!Solide#{sfx}"
    resp = await raw_client.put(
        "/api/auth/change-password",
        json={"current_password": initial_pwd, "new_password": new_pwd},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    # Le blocage est levé / Block is lifted
    resp = await raw_client.get("/api/users/", headers=headers)
    assert resp.status_code == 200

    resp = await raw_client.get("/api/auth/me", headers=headers)
    assert resp.json()["must_change_password"] is False
