"""Tests for configuration validation and fail-fast production security."""

import pytest
from pydantic import ValidationError

from backend.core.config import Settings


def test_production_default_webhook_secret_raises_validation_error():
    """In production, using the default placeholder 'mating-secret-token' must fail fast."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            APP_ENV="production",
            WEBHOOK_SECRET="mating-secret-token",
        )
    errors = str(exc_info.value)
    assert "WEBHOOK_SECRET must be configured" in errors
    assert "mating-secret-token" in errors


def test_production_empty_webhook_secret_raises_validation_error():
    """In production, an empty WEBHOOK_SECRET must fail fast."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            APP_ENV="production",
            WEBHOOK_SECRET="",
        )
    errors = str(exc_info.value)
    assert "WEBHOOK_SECRET must be configured" in errors


def test_production_whitespace_webhook_secret_raises_validation_error():
    """In production, a whitespace-only WEBHOOK_SECRET must fail fast."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            APP_ENV="production",
            WEBHOOK_SECRET="   ",
        )
    errors = str(exc_info.value)
    assert "WEBHOOK_SECRET must be configured" in errors


def test_production_secure_webhook_secret_succeeds():
    """In production, a custom strong secret must instantiate successfully."""
    custom_secret = "c7d8e9f0-a1b2-4c3d-9e8f-7a6b5c4d3e2f-secure-prod-key"
    cfg = Settings(
        APP_ENV="production",
        WEBHOOK_SECRET=custom_secret,
    )
    assert cfg.is_production is True
    assert cfg.WEBHOOK_SECRET == custom_secret


def test_development_default_webhook_secret_allowed():
    """In development, default placeholder secret is allowed for developer convenience."""
    cfg = Settings(
        APP_ENV="development",
        WEBHOOK_SECRET="mating-secret-token",
    )
    assert cfg.is_production is False
    assert cfg.WEBHOOK_SECRET == "mating-secret-token"


def test_test_environment_default_webhook_secret_allowed():
    """In test environment, default placeholder secret is allowed."""
    cfg = Settings(
        APP_ENV="test",
        WEBHOOK_SECRET="mating-secret-token",
    )
    assert cfg.is_test is True
    assert cfg.WEBHOOK_SECRET == "mating-secret-token"


def test_production_env_var_injection_fails_with_default(monkeypatch):
    """When APP_ENV=production is injected via environment variables without setting WEBHOOK_SECRET,
    instantiation fails fast.
    """
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("WEBHOOK_SECRET", raising=False)
    with pytest.raises(ValidationError) as exc_info:
        Settings()
    assert "WEBHOOK_SECRET must be configured" in str(exc_info.value)


def test_production_env_var_injection_succeeds_with_strong_secret(monkeypatch):
    """When APP_ENV=production and a custom WEBHOOK_SECRET are set via env vars,
    instantiation succeeds.
    """
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("WEBHOOK_SECRET", "super-secret-prod-token-xyz-12345")
    cfg = Settings()
    assert cfg.is_production is True
    assert cfg.WEBHOOK_SECRET == "super-secret-prod-token-xyz-12345"
