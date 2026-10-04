"""
Application configuration for SENTINEL-X backend.

All configuration is sourced from environment variables (see .env.example
at the project root). No secrets or credentials are hardcoded here.
"""
from functools import lru_cache
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- General ---
    APP_NAME: str = "SENTINEL-X"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    API_V1_PREFIX: str = "/api/v1"

    # --- Security ---
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080

    # --- Database ---
    POSTGRES_USER: str = "sentinel"
    POSTGRES_PASSWORD: str = "sentinel"
    POSTGRES_DB: str = "sentinelx"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: Optional[str] = None

    # --- CORS ---
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # --- Ports ---
    BACKEND_PORT: int = 8000
    FRONTEND_PORT: int = 5173

    # --- ML ---
    ML_MODEL_DIR: str = "/app/ml_artifacts"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("SECRET_KEY")
    @classmethod
    def _validate_secret_key(cls, value: str) -> str:
        if not value or len(value) < 16:
            raise ValueError(
                "SECRET_KEY must be set to a random string of at least 16 "
                "characters. Generate one with: openssl rand -hex 32"
            )
        return value

    @property
    def database_url(self) -> str:
        """Fully-qualified async SQLAlchemy database URL."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()