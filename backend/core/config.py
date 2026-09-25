"""Application configuration for Mating."""

from __future__ import annotations

import json
from typing import Any
from pydantic import field_validator
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
    WEBAPP_URL: str = ""

    # Database & Cache
    DATABASE_URL: str = "sqlite+aiosqlite:///./mating.db"
    REDIS_URL: str | None = None

    # AI Configuration
    AI_PROVIDER: str = "gemini"  # gemini, groq, openai, heuristic
    AI_PRIMARY_KEY: str = ""
    AI_FALLBACK_KEY: str = ""
    AI_MODEL: str = "gemini-2.5-flash"
    AI_RATE_LIMIT_PER_MINUTE: int = 30

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://web.telegram.org",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, tuple)):
            return [str(i).strip() for i in v]
        return ["*"] if cls().APP_ENV == "development" else []

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def is_test(self) -> bool:
        return self.APP_ENV.lower() == "test"


settings = Settings()
