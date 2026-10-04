"""
System health API.

Reports the health of each major subsystem: the API itself, the database,
the ingestion engine, the rule-based detection engine, and the ML anomaly
engine. This supersedes the minimal inline health check that lived
directly on the FastAPI app (app/main.py) through Batch 9 — that endpoint
existed only as a placeholder until this router existed. It is mounted at
the identical path, /api/v1/health, so no external contract changes.
"""
from fastapi import APIRouter

from app.core.database import check_database_connection
from app.core.websocket_manager import manager
from app.detection.rule_registry import ALL_RULES
from app.ml.model_registry import registry as ml_registry

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check() -> dict:
    db_ok = await check_database_connection()
    model = ml_registry.get_model()
    ml_ok = model is not None and model.is_fitted

    components = {
        "api": "healthy",
        "database": "healthy" if db_ok else "unhealthy",
        "ingestion": "healthy" if db_ok else "unhealthy",
        "detection_engine": "healthy" if (db_ok and len(ALL_RULES) > 0) else "unhealthy",
        "ml_engine": "healthy" if ml_ok else "degraded",
        "realtime_connections": manager.active_connection_count,
    }

    if not db_ok:
        overall = "unhealthy"
    elif not ml_ok:
        overall = "degraded"
    else:
        overall = "healthy"

    return {"status": overall, "components": components}