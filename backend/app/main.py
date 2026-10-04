"""
SENTINEL-X Backend Entry Point.

Wires together the FastAPI application, core middleware, and startup/shutdown
lifecycle. Domain API routers are registered via app.api.router.api_router
and grow incrementally as each subsystem is implemented (see
docs/PROJECT_STRUCTURE.md). As of Batch 10, the full detection ->
correlation -> ML -> incident pipeline runs automatically on ingestion
(see app.services.pipeline), and system health is reported by
app/api/health.py rather than an inline endpoint on this module.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import check_database_connection
from app.core.logging_config import setup_logging

setup_logging()
logger = logging.getLogger("sentinelx.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s (%s environment)...", settings.APP_NAME, settings.ENVIRONMENT)
    if await check_database_connection():
        logger.info("Database connection established.")
    else:
        logger.warning(
            "Database connection could not be established at startup. "
            "The API will still start, but data-dependent endpoints will "
            "fail until the database becomes available."
        )
    yield
    logger.info("Shutting down %s.", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Real-Time Cyber Threat Detection, Security Monitoring & "
        "Defensive Response Platform (defensive, local-lab scope only)."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["root"])
async def root() -> dict:
    return {
        "service": settings.APP_NAME,
        "status": "online",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
    }