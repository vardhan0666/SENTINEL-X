"""
Analytics aggregation service — powers the dashboard's Overview and
Analytics pages with real, computed aggregates. No values here are
hardcoded; every figure is derived from the current contents of the
events, detections, incidents, and assets tables.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.detection import Detection, DetectionType
from app.models.event import Event
from app.models.incident import Incident, IncidentStatus
from app.schemas.analytics import (
    DetectionTypeDistributionItem,
    EventsOverTimePoint,
    OverviewStats,
    SeverityDistributionItem,
    TopSourceItem,
)

_ACTIVE_INCIDENT_STATUSES = (IncidentStatus.NEW, IncidentStatus.INVESTIGATING, IncidentStatus.CONTAINED)


async def get_overview_stats(db: AsyncSession) -> OverviewStats:
    total_events = (await db.execute(select(func.count()).select_from(Event))).scalar_one()

    active_incidents = (
        await db.execute(
            select(func.count()).select_from(Incident).where(Incident.status.in_(_ACTIVE_INCIDENT_STATUSES))
        )
    ).scalar_one()

    critical_alerts = (
        await db.execute(select(func.count()).select_from(Detection).where(Detection.severity == "critical"))
    ).scalar_one()

    high_risk_events = (
        await db.execute(
            select(func.count()).select_from(Event).where(Event.severity.in_(["high", "critical"]))
        )
    ).scalar_one()

    anomaly_count = (
        await db.execute(
            select(func.count())
            .select_from(Detection)
            .where(Detection.detection_type == DetectionType.ML_ANOMALY)
        )
    ).scalar_one()

    monitored_assets = (await db.execute(select(func.count()).select_from(Asset))).scalar_one()

    return OverviewStats(
        total_events=total_events,
        active_incidents=active_incidents,
        critical_alerts=critical_alerts,
        high_risk_events=high_risk_events,
        anomaly_count=anomaly_count,
        monitored_assets=monitored_assets,
    )


async def get_events_over_time(
    db: AsyncSession, hours: int = 24, bucket_minutes: int = 60
) -> list[EventsOverTimePoint]:
    """
    Bucket event counts into fixed-size time windows over the trailing
    `hours` period. Bucketing is performed in Python rather than with a
    database-specific date-truncation function, so this works identically
    against both PostgreSQL and the SQLite test database.
    """
    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(hours=hours)

    result = await db.execute(
        select(Event.timestamp).where(Event.timestamp >= window_start, Event.timestamp <= window_end)
    )
    timestamps = [row[0] for row in result.all()]

    bucket_size = timedelta(minutes=bucket_minutes)
    bucket_count = max(1, int(hours * 60 / bucket_minutes))
    buckets = [window_start + (bucket_size * i) for i in range(bucket_count + 1)]
    counts = [0] * (len(buckets) - 1)

    for ts in timestamps:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        for i in range(len(buckets) - 1):
            if buckets[i] <= ts < buckets[i + 1]:
                counts[i] += 1
                break

    return [EventsOverTimePoint(bucket=buckets[i], count=counts[i]) for i in range(len(counts))]


async def get_severity_distribution(db: AsyncSession) -> list[SeverityDistributionItem]:
    result = await db.execute(select(Event.severity, func.count()).group_by(Event.severity))
    return [SeverityDistributionItem(severity=row[0], count=row[1]) for row in result.all()]


async def get_top_sources(db: AsyncSession, limit: int = 10) -> list[TopSourceItem]:
    result = await db.execute(
        select(Event.source_ip, func.count().label("count"))
        .where(Event.source_ip.isnot(None))
        .group_by(Event.source_ip)
        .order_by(func.count().desc())
        .limit(limit)
    )
    return [TopSourceItem(source_ip=row[0], count=row[1]) for row in result.all()]


async def get_detection_type_distribution(db: AsyncSession) -> list[DetectionTypeDistributionItem]:
    result = await db.execute(select(Detection.detection_type, func.count()).group_by(Detection.detection_type))
    return [
        DetectionTypeDistributionItem(detection_type=row[0].value, count=row[1]) for row in result.all()
    ]