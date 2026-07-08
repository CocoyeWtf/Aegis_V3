"""Tests remédiation STIME B7 — MFA TOTP sur les comptes privilégiés.

Flux complet : enrôlement → activation → login en 2 étapes (mot de passe puis
code TOTP) → jeton MFA à usage unique → désactivation contrôlée.
"""

import uuid

import pyotp
import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def jwt_client(db_session):
    """Client JWT réel (sans bypass), rate limit désactivé, + superadmin dédié."""
    from httpx import ASGITransport, AsyncClient

    from app.main import app
    from app.models.user import User
    from app.utils.auth import hash_password

    sfx = uuid.uuid4().hex[:8]
    password = f"Mfa!Solide#{sfx}Xx"
    user = User(
        username=f"mfa_{sfx}", email=f"mfa-{sfx}@chaos-route.app",
        hashed_password=hash_password(password), is_active=True, is_superadmin=True,
    )
    db_session.add(user)
    await db_session.commit()

    app.state.limiter.enabled = False
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, user, password
    app.state.limiter.enabled = True


async def _login(ac, user, password):
    return await ac.post("/api/auth/login", json={"username": user.username, "password": password})


@pytest.mark.asyncio
async def test_full_mfa_flow(jwt_client):
    ac, user, password = jwt_client

    # 1. Login sans MFA : jetons directs / Without MFA: direct tokens
    resp = await _login(ac, user, password)
    assert resp.status_code == 200
    assert resp.json()["mfa_required"] is False
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    # 2. Enrôlement : secret + URI otpauth / Enrollment: secret + otpauth URI
    resp = await ac.post("/api/auth/mfa/enroll", headers=headers)
    assert resp.status_code == 200, resp.text
    secret = resp.json()["secret"]
    assert "otpauth://" in resp.json()["otpauth_uri"]

    # 3. Activation : code invalide refusé, code valide accepté
    resp = await ac.post("/api/auth/mfa/activate", json={"code": "000000"}, headers=headers)
    assert resp.status_code == 400
    good_code = pyotp.TOTP(secret).now()
    resp = await ac.post("/api/auth/mfa/activate", json={"code": good_code}, headers=headers)
    assert resp.status_code == 200, resp.text

    # /me expose l'état / /me exposes the state
    resp = await ac.get("/api/auth/me", headers=headers)
    assert resp.json()["mfa_enabled"] is True

    # 4. Login : plus de jetons directs, un jeton MFA intermédiaire
    resp = await _login(ac, user, password)
    body = resp.json()
    assert body["mfa_required"] is True
    assert body["access_token"] == ""
    mfa_token = body["mfa_token"]

    # 5. Mauvais code refusé / Wrong code rejected
    resp = await ac.post("/api/auth/mfa-verify", json={"mfa_token": mfa_token, "code": "123456"})
    assert resp.status_code == 401

    # 6. Bon code → jetons complets / Good code → full tokens
    code = pyotp.TOTP(secret).now()
    resp = await ac.post("/api/auth/mfa-verify", json={"mfa_token": mfa_token, "code": code})
    assert resp.status_code == 200, resp.text
    tokens = resp.json()
    assert tokens["access_token"]
    headers2 = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert (await ac.get("/api/auth/me", headers=headers2)).status_code == 200

    # 7. Rejeu du jeton MFA : refusé (usage unique) / MFA token replay rejected
    resp = await ac.post("/api/auth/mfa-verify", json={"mfa_token": mfa_token, "code": pyotp.TOTP(secret).now()})
    assert resp.status_code == 401

    # 8. Désactivation : exige mot de passe ET code / Disable requires pwd AND code
    resp = await ac.post("/api/auth/mfa/disable",
                         json={"password": "faux", "code": pyotp.TOTP(secret).now()},
                         headers=headers2)
    assert resp.status_code == 400
    resp = await ac.post("/api/auth/mfa/disable",
                         json={"password": password, "code": pyotp.TOTP(secret).now()},
                         headers=headers2)
    assert resp.status_code == 200, resp.text

    # Login redevient direct / Login is direct again
    resp = await _login(ac, user, password)
    assert resp.json()["mfa_required"] is False
    assert resp.json()["access_token"]
