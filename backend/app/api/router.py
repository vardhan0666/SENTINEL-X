"""
Aggregates all versioned API routers under a single api_router, which is
mounted in app.main under settings.API_V1_PREFIX (/api/v1).

The only remaining planned router is `simulation` (Batch 11), deferred
because it depends on the simulator client that does not exist until that
batch. See docs/PROJECT_STRUCTURE.md for the full planned set.
"""
from fastapi import APIRouter

from app.api import (
    alerts,
    analytics,
    assets,
    audit,
    auth,
    detections,
    events,
    health,
    incidents,
    indicators,
    ml,
    rules,
    ws,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(events.router)
api_router.include_router(detections.router)
api_router.include_router(alerts.router)
api_router.include_router(rules.router)
api_router.include_router(ml.router)
api_router.include_router(incidents.router)
api_router.include_router(audit.router)
api_router.include_router(assets.router)
api_router.include_router(indicators.router)
api_router.include_router(analytics.router)
api_router.include_router(health.router)
api_router.include_router(ws.router)