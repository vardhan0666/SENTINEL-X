"""
Analytics aggregate API — powers the dashboard's Overview and Analytics pages.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.schemas.analytics import (
    DetectionTypeDistributionItem,
    EventsOverTimePoint,
    OverviewStats,
    SeverityDistributionItem,
    TopSourceItem,
)
from app.services.analytics_service import (
    get_detection_type_distribution,
    get_events_over_time,
    get_overview_stats,
    get_severity_distribution,
    get_top_sources,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewStats)
async def overview(current_user: CurrentUser, db: AsyncSession = Depends(get_db)) -> OverviewStats:
    return await get_overview_stats(db)


@router.get("/events-over-time", response_model=list[EventsOverTimePoint])
async def events_over_time(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    hours: int = Query(24, ge=1, le=168),
    bucket_minutes: int = Query(60, ge=5, le=1440),
) -> list[EventsOverTimePoint]:
    return await get_events_over_time(db, hours=hours, bucket_minutes=bucket_minutes)


@router.get("/severity-distribution", response_model=list[SeverityDistributionItem])
async def severity_distribution(
    current_user: CurrentUser, db: AsyncSession = Depends(get_db)
) -> list[SeverityDistributionItem]:
    return await get_severity_distribution(db)


@router.get("/top-sources", response_model=list[TopSourceItem])
async def top_sources(
    current_user: CurrentUser, db: AsyncSession = Depends(get_db), limit: int = Query(10, ge=1, le=50)
) -> list[TopSourceItem]:
    return await get_top_sources(db, limit=limit)


@router.get("/detection-types", response_model=list[DetectionTypeDistributionItem])
async def detection_type_distribution(
    current_user: CurrentUser, db: AsyncSession = Depends(get_db)
) -> list[DetectionTypeDistributionItem]:
    return await get_detection_type_distribution(db)