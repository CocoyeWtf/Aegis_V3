"""Fixtures partagees pour les tests / Shared test fixtures.

Strategie : DB de test isolee (sqlite fichier) creee depuis Base.metadata,
auth bypass via dependency_overrides sur get_current_user. Chaque test reutilise
les tables creees au demarrage, et chaque fonction de test obtient ses propres
PDV/SupportType via codes uniques (uuid prefix).
"""

import os
import sys
import uuid
from pathlib import Path

import pytest
import pytest_asyncio

# Pointer vers une DB de test isolee AVANT d'importer app.* /
# Point to an isolated test DB BEFORE importing app.*
_TEST_DB_PATH = Path(__file__).parent / "_test_combi.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TEST_DB_PATH.as_posix()}"

# Permettre l'import de "app" / Allow "app" import
sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _init_test_db():
    """Creer les tables de test une seule fois par session /
    Create test tables once per session.
    """
    # Import app.main pour charger tous les modeles via les routers /
    # Import app.main to load all models via the routers
    import app.main  # noqa: F401
    from app.database import Base, engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Nettoyage en fin de session / Cleanup at end of session
    await engine.dispose()
    if _TEST_DB_PATH.exists():
        try:
            _TEST_DB_PATH.unlink()
        except OSError:
            pass


@pytest_asyncio.fixture
async def db_session():
    """Session DB pour test direct / Direct DB session for tests."""
    from app.database import async_session

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def test_user(db_session):
    """Utilisateur superadmin pour bypass des permissions /
    Superadmin user to bypass permissions.
    """
    from app.models.user import User

    suffix = uuid.uuid4().hex[:8]
    user = User(
        username=f"test_{suffix}",
        email=f"test-{suffix}@chaos.test",
        hashed_password="x",
        is_active=True,
        is_superadmin=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_region(db_session):
    """Region de test / Test region."""
    from app.models.country import Country
    from app.models.region import Region
    from sqlalchemy import select

    # Reutiliser ou creer un pays de test / Reuse or create test country
    result = await db_session.execute(select(Country).where(Country.code == "TST"))
    country = result.scalar_one_or_none()
    if not country:
        country = Country(name="Test Country", code="TST")
        db_session.add(country)
        await db_session.commit()
        await db_session.refresh(country)

    region = Region(name=f"Region {uuid.uuid4().hex[:5]}", country_id=country.id)
    db_session.add(region)
    await db_session.commit()
    await db_session.refresh(region)
    return region


@pytest_asyncio.fixture
async def test_pdv(db_session, test_region):
    """PDV de test avec code unique / Test PDV with unique code."""
    from app.models.pdv import PDV, PDVType

    code = f"T{uuid.uuid4().hex[:5].upper()}"
    pdv = PDV(
        code=code,
        name=f"PDV Test {code}",
        type=PDVType.HYPER,
        address="Test address",
        city="Test city",
        postal_code="0000",
        latitude=50.0,
        longitude=4.0,
        region_id=test_region.id,
    )
    db_session.add(pdv)
    await db_session.commit()
    await db_session.refresh(pdv)
    return pdv


@pytest_asyncio.fixture
async def test_combi_support_type(db_session):
    """Support type combi avec code unique / Combi support type with unique code."""
    from app.models.support_type import SupportType

    code = f"CO_T_{uuid.uuid4().hex[:5].upper()}"
    st = SupportType(
        code=code,
        short_code="CO",
        name="Combi Test",
        unit_quantity=1,
        is_active=True,
        is_combi=True,
    )
    db_session.add(st)
    await db_session.commit()
    await db_session.refresh(st)
    return st


@pytest_asyncio.fixture
async def client(test_user):
    """Client HTTP avec auth bypass / HTTP client with auth bypass.

    Override get_current_user pour injecter le test_user dans require_permission.
    """
    from httpx import ASGITransport, AsyncClient

    from app.api.deps import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: test_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
