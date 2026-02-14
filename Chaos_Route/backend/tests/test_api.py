"""Tests API / API tests."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_root(client):
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "running"


@pytest.mark.asyncio
async def test_create_country(client):
    resp = await client.post("/api/countries/", json={"name": "France", "code": "FR"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "France"
    assert data["code"] == "FR"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_countries(client):
    resp = await client.get("/api/countries/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
