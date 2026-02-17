"""
Point d'entrée FastAPI / FastAPI entry point.
Chaos RouteManager - Optimiseur de tournées VRP.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.config import settings
from app.database import async_session, init_db
from app.utils.seed import seed_superadmin


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialisation et fermeture / Startup and shutdown."""
    # Créer les tables au démarrage (dev uniquement) / Create tables on startup (dev only)
    await init_db()
    # Seed superadmin si aucun utilisateur / Seed superadmin if no users
    async with async_session() as session:
        await seed_superadmin(session)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Optimiseur de tournées pour la grande distribution / VRP optimizer for retail distribution",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes API
app.include_router(api_router)


@app.get("/")
async def root():
    """Health check."""
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}
