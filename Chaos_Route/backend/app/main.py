"""
Point d'entrée FastAPI / FastAPI entry point.
Chaos RouteManager - Optimiseur de tournées VRP.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.config import settings
from app.database import async_session, init_db
from app.utils.seed import seed_superadmin

# Dossier du build React en production / React build dir in production
STATIC_DIR = Path("/app/static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialisation et fermeture / Startup and shutdown."""
    # Créer les tables au démarrage / Create tables on startup
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


# Santé de l'API / API health check
@app.get("/api/")
async def api_health():
    """Health check (accessible en dev et prod)."""
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


# Servir le SPA React en production / Serve React SPA in production
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="static-assets")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        """Fallback SPA : sert les fichiers statiques ou index.html / SPA fallback."""
        file_path = STATIC_DIR / path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
else:
    # Dev : health check à la racine / Dev: root health check
    @app.get("/")
    async def root():
        """Health check (dev)."""
        return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}
