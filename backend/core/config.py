"""Application configuration for Mating."""

from __future__ import annotations

import json
from typing import Any

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = "development"  # development, test, production
    DEBUG: bool = False

    # Telegram Bot
    BOT_TOKEN: str = ""
    WEBHOOK_SECRET: str = "mating-secret-token"
    WEBAPP_URL: str = "https://mating.vercel.app"

    # Database & Cache
    DATABASE_URL: str = "sqlite+aiosqlite:///./mating.db"
    REDIS_URL: str | None = None

    # AI Configuration
    AI_PROVIDER: str = "gemini"  # gemini, groq, openai, heuristic
    AI_PRIMARY_KEY: str = ""
    AI_API_KEY: str = ""  # alias used in Vercel
    AI_FALLBACK_KEY: str = ""
    AI_MODEL: str = "gemini-2.5-flash"
    AI_RATE_LIMIT_PER_MINUTE: int = 30

    # CORS (Use str | list[str] so pydantic-settings doesn't treat it as complex json)
    ALLOWED_ORIGINS: str | list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://mating.vercel.app",
        "https://web.telegram.org",
        "https://*.telegram.org",
    ]

    @model_validator(mode="after")
    def validate_production_security(self) -> Settings:
        """Fail-fast validation for critical security settings in production.

        Enforces that WEBHOOK_SECRET is set to a secure, custom secret whenever
        APP_ENV is 'production'. Rejects empty values and the default placeholder
        'mating-secret-token'.
        """
        if self.is_production:
            insecure_secrets = {"", "mating-secret-token"}
            secret = (self.WEBHOOK_SECRET or "").strip()
            if not secret or secret in insecure_secrets:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: "
                    "WEBHOOK_SECRET must be configured with a secure, unique secret token in production environment! "
                    f"Current value is insecure: {self.WEBHOOK_SECRET!r}. "
                    "Empty secret or default placeholder 'mating-secret-token' is strictly prohibited."
                )
        return self

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: Any) -> str:
        """Ensure standard asyncpg URL scheme for PostgreSQL connections."""
        if not v or not isinstance(v, str):
            return "sqlite+aiosqlite:///./mating.db"
        url = v.strip()
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://"):]
        return url

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        default_prod = [
            "https://mating.vercel.app",
            "https://web.telegram.org",
            "https://*.telegram.org",
        ]
        if not v:
            return default_prod
        if isinstance(v, str):
            v_clean = v.strip()
            if not v_clean:
                return default_prod
            if v_clean.startswith("[") and v_clean.endswith("]"):
                try:
                    return json.loads(v_clean)
                except Exception:
                    pass
            origins = [i.strip() for i in v_clean.split(",") if i.strip()]
            return origins or default_prod
        elif isinstance(v, (list, tuple)):
            return [str(i).strip() for i in v]
        return default_prod

    @property
    def primary_ai_key(self) -> str:
        return self.AI_PRIMARY_KEY or self.AI_API_KEY

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def is_test(self) -> bool:
        return self.APP_ENV.lower() == "test"


settings = Settings()
