"""Tests remédiation STIME A4 — cookies HttpOnly + révocation serveur des jetons.

Couvre : pose des cookies au login, authentification par cookie seul (sans
header Authorization), logout qui révoque réellement les jetons côté serveur,
rotation du refresh token (usage unique), purge des révocations expirées.
"""

import uuid

import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def jwt_client(db_session):
    """Client JWT réel (sans bypass d'auth), rate limit désactivé, + user dédié."""
    from httpx import ASGITransport, AsyncClient

    from app.main import app
    from app.models.user import User
    from app.utils.auth import hash_password

    sfx = uuid.uuid4().hex[:8]
    password = f"Cookie!Solide#{sfx}"
    user = User(
        username=f"cookie_{sfx}", email=f"cookie-{sfx}@chaos-route.app",
        hashed_password=hash_password(password), is_active=True, is_superadmin=True,
    )
    db_session.add(user)
    await db_session.commit()

    app.state.limiter.enabled = False
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, user, password
    app.state.limiter.enabled = True


@pytest.mark.asyncio
async def test_login_sets_httponly_cookies(jwt_client):
    ac, user, password = jwt_client
    resp = await ac.post("/api/auth/login", json={"username": user.username, "password": password})
    assert resp.status_code == 200, resp.text

    cookies = resp.headers.get_list("set-cookie")
    access = next(c for c in cookies if c.startswith("access_token="))
    refresh = next(c for c in cookies if c.startswith("refresh_token="))
    assert "HttpOnly" in access
    assert "SameSite=lax" in access.lower() or "samesite=lax" in access.lower()
    assert "HttpOnly" in refresh
    # Le refresh cookie est confiné au chemin auth / Refresh cookie scoped to auth path
    assert "Path=/api/auth" in refresh


@pytest.mark.asyncio
async def test_cookie_only_authentication(jwt_client):
    ac, user, password = jwt_client
    await ac.post("/api/auth/login", json={"username": user.username, "password": password})

    # Aucun header Authorization : le cookie du jar httpx suffit
    resp = await ac.get("/api/auth/me")
    assert resp.status_code == 200, resp.text
    assert resp.json()["username"] == user.username


@pytest.mark.asyncio
async def test_logout_revokes_tokens_server_side(jwt_client):
    ac, user, password = jwt_client
    resp = await ac.post("/api/auth/login", json={"username": user.username, "password": password})
    tokens = resp.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Le jeton fonctionne avant logout / Token works before logout
    assert (await ac.get("/api/auth/me", headers=headers)).status_code == 200

    resp = await ac.post("/api/auth/logout", headers=headers)
    assert resp.status_code == 200, resp.text

    # Le MÊME jeton est refusé après logout (révocation serveur, pas juste
    # suppression côté client) / Same token rejected after logout
    resp = await ac.get("/api/auth/me", headers=headers)
    assert resp.status_code == 401
    assert "revoked" in resp.json()["detail"].lower()

    # Le refresh token du logout est lui aussi révoqué / Refresh also revoked
    resp = await ac.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_rotation_single_use(jwt_client):
    ac, user, password = jwt_client
    resp = await ac.post("/api/auth/login", json={"username": user.username, "password": password})
    first_refresh = resp.json()["refresh_token"]

    # 1er usage : OK, nouveaux jetons / First use: OK, new tokens
    resp = await ac.post("/api/auth/refresh", json={"refresh_token": first_refresh})
    assert resp.status_code == 200, resp.text
    second_refresh = resp.json()["refresh_token"]
    assert second_refresh != first_refresh

    # Rejeu de l'ancien : refusé (rotation = usage unique) / Replay rejected
    resp = await ac.post("/api/auth/refresh", json={"refresh_token": first_refresh})
    assert resp.status_code == 401

    # Le nouveau fonctionne / New one works
    resp = await ac.post("/api/auth/refresh", json={"refresh_token": second_refresh})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_purge_expired_revocations(db_session):
    from app.models.revoked_token import RevokedToken
    from app.services.token_revocation import purge_expired_revocations

    db_session.add(RevokedToken(
        jti=uuid.uuid4().hex, token_type="access", user_id=None,
        expires_at="2020-01-01T00:00:00+00:00", revoked_at="2020-01-01T00:00:00+00:00",
        reason="logout",
    ))
    await db_session.commit()

    purged = await purge_expired_revocations(db_session)
    await db_session.commit()
    assert purged >= 1
