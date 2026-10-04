"""
Windowed feature extraction for ML-based anomaly detection.

Produces a fixed-order feature vector describing an entity's (source IP,
username, or hostname) behavior over a trailing time window. Used by both
the statistical baseline detector (app.ml.baseline_stats) and the
Isolation Forest model (app.ml.isolation_forest_model) — both methods
reason over the exact same feature definition, so their results remain
directly comparable.
"""
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event

FEATURE_NAMES = [
    "auth_attempts",
    "distinct_destinations",
    "distinct_ports",
    "dns_queries",
    "process_starts",
]

_ENTITY_COLUMNS = {
    "SOURCE_IP": Event.source_ip,
    "USERNAME": Event.username,
    "HOSTNAME": Event.hostname,
}


async def extract_features_for_entity(
    db: AsyncSession,
    entity_type: str,
    entity_value: str,
    window_end: datetime,
    window_seconds: int = 300,
) -> dict[str, float]:
    """
    Compute the feature vector for `entity_value` (of `entity_type`) over
    the half-open window (window_end - window_seconds, window_end].
    """
    entity_type = entity_type.upper()
    column = _ENTITY_COLUMNS.get(entity_type)
    if column is None:
        raise ValueError(
            f"Unsupported entity_type '{entity_type}'. Expected one of {list(_ENTITY_COLUMNS)}."
        )

    window_start = window_end - timedelta(seconds=window_seconds)
    base_conditions = (column == entity_value, Event.timestamp > window_start, Event.timestamp <= window_end)

    auth_attempts = await _count(db, base_conditions, Event.category == "authentication")
    distinct_destinations = await _count_distinct(db, base_conditions, Event.destination_ip)
    distinct_ports = await _count_distinct(db, base_conditions, Event.destination_port)
    dns_queries = await _count(db, base_conditions, Event.category == "dns")
    process_starts = await _count(db, base_conditions, Event.event_type == "process_start")

    return {
        "auth_attempts": float(auth_attempts),
        "distinct_destinations": float(distinct_destinations),
        "distinct_ports": float(distinct_ports),
        "dns_queries": float(dns_queries),
        "process_starts": float(process_starts),
    }


async def _count(db: AsyncSession, base_conditions, extra_condition) -> int:
    query = select(func.count()).select_from(Event).where(*base_conditions, extra_condition)
    return (await db.execute(query)).scalar_one()


async def _count_distinct(db: AsyncSession, base_conditions, column) -> int:
    query = select(func.count(func.distinct(column))).where(*base_conditions, column.isnot(None))
    return (await db.execute(query)).scalar_one()


def feature_dict_to_vector(features: dict[str, float]) -> list[float]:
    """Convert a feature dict into a fixed-order vector matching FEATURE_NAMES."""
    return [features.get(name, 0.0) for name in FEATURE_NAMES]