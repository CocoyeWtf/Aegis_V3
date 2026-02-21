"""
Point d'entree FastAPI / FastAPI entry point.
Chaos RouteManager - Optimiseur de tournees VRP.
"""

import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import api_router
from app.api.ws_tracking import router as ws_router
from app.api.mobile_setup import router as mobile_setup_router
from app.config import settings
from app.database import async_session, init_db
from app.rate_limit import limiter
from app.utils.seed import seed_superadmin

logger = logging.getLogger("chaos_route")

# Dossier du build React en production / React build dir in production
STATIC_DIR = Path("/app/static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialisation et fermeture / Startup and shutdown."""
    # Validation SECRET_KEY en production / Validate SECRET_KEY in production
    if not settings.DEBUG and settings.SECRET_KEY == "change-me-in-production":
        raise RuntimeError("CRITICAL: SECRET_KEY must be changed in production!")

    # Creer les tables au demarrage / Create tables on startup
    await init_db()
    # Seed superadmin si aucun utilisateur / Seed superadmin if no users
    async with async_session() as session:
        await seed_superadmin(session)
    yield


# 3C. Desactiver Swagger en production / Disable Swagger in production
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Optimiseur de tournees pour la grande distribution / VRP optimizer for retail distribution",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# 2D. Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 3A. CORS durci / Hardened CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Device-ID", "X-Requested-With"],
)


# 3B. Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Ajoute les headers de securite / Add security headers."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app.add_middleware(SecurityHeadersMiddleware)


# 5B. Request ID tracking middleware
class RequestIDMiddleware(BaseHTTPMiddleware):
    """Ajoute un X-Request-ID unique a chaque requete / Add unique X-Request-ID to each request."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


app.add_middleware(RequestIDMiddleware)


# Routes API
app.include_router(api_router)

# WebSocket (monte a la racine, pas sous /api) / WebSocket (mounted at root, not under /api)
app.include_router(ws_router)

# Page installation mobile (racine, publique) / Mobile install page (root, public)
app.include_router(mobile_setup_router)


# Sante de l'API / API health check
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
    # Dev : health check a la racine / Dev: root health check
    @app.get("/")
    async def root():
        """Health check (dev)."""
        return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


# 5C. Logging JSON structure en production / Structured JSON logging in production
if not settings.DEBUG:
    import json

    class JSONFormatter(logging.Formatter):
        def format(self, record):
            log_entry = {
                "timestamp": self.formatTime(record),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
            if record.exc_info and record.exc_info[0]:
                log_entry["exception"] = self.formatException(record.exc_info)
            return json.dumps(log_entry)

    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    logging.root.handlers = [handler]
    logging.root.setLevel(logging.INFO)
