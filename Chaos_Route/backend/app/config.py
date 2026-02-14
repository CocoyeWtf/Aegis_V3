"""
Configuration de l'application / Application configuration.
Utilise pydantic-settings pour charger depuis .env ou variables d'environnement.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Chaos RouteManager"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database - SQLite par défaut pour le développement
    # Database - SQLite by default for development
    DATABASE_URL: str = "sqlite+aiosqlite:///./chaos_route.db"

    # CORS - origines autorisées / allowed origins
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Paramètres par défaut / Default parameters
    DEFAULT_COMMERCIAL_SPEED_KMH: float = 60.0
    DEFAULT_MAX_DAILY_HOURS: float = 10.0
    DEFAULT_BREAK_DURATION_MINUTES: int = 45

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
