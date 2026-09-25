"""FastAPI main application entrypoint for Mating."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.api.routes import ai, bot, health, items, profile, stats
from backend.core.config import settings

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("mating.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Mating application (ENV=%s)", settings.APP_ENV)
    yield
    logger.info("Shutting down Mating application")


app = FastAPI(
    title="Mating API",
    description="Minimalist AI-powered shopping assistant for Telegram",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url=None,
)

# ── CORS Middleware ──
# When credentials are enabled, wildcard origin is strictly forbidden
cors_origins = settings.ALLOWED_ORIGINS
if "*" in cors_origins and not settings.is_production:
    # In dev without credentials allow *
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Telegram-Bot-Api-Secret-Token"],
    )


# ── Standardized Error Handlers (Section 18 API Error Contract) ──

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        error_payload = detail
    else:
        error_payload = {
            "error": {
                "code": "HTTP_ERROR",
                "message": str(detail) if detail else "An HTTP error occurred",
            }
        }
    return JSONResponse(status_code=exc.status_code, content=error_payload)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Safe validation error message without leaking sensitive internal schemas
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    msg = first_error.get("msg", "Validation error")
    loc = " -> ".join(str(l) for l in first_error.get("loc", []))
    safe_message = f"Invalid field {loc}: {msg}" if loc else msg

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": safe_message,
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An internal error occurred. Please try again later.",
            }
        },
    )


# ── Include Routers ──
app.include_router(health.router)
app.include_router(profile.router)
app.include_router(items.router)
app.include_router(ai.router)
app.include_router(stats.router)
app.include_router(bot.router)

# Mount frontend static distribution if built
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=8000, reload=True)
