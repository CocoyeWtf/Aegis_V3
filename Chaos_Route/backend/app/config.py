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
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8081", "http://localhost:19006"]

    # JWT Authentication
    SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate Limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REGISTER: str = "3/minute"
    RATE_LIMIT_GPS: str = "30/minute"
    RATE_LIMIT_DEFAULT: str = "60/minute"

    # Paramètres par défaut / Default parameters
    DEFAULT_COMMERCIAL_SPEED_KMH: float = 60.0
    DEFAULT_MAX_DAILY_HOURS: float = 10.0
    DEFAULT_BREAK_DURATION_MINUTES: int = 45

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
