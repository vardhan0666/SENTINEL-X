"""
Business-rule validation for ingested events, beyond what Pydantic's
EventIngest schema already enforces (required fields, port ranges,
allowed severities).

This module checks:
  - the event's `source` is one of the sources SENTINEL-X understands
  - the event's timestamp is not implausibly far in the future or past
    (guards against clock-skew or malformed telemetry silently poisoning
    the time-windowed queries the detection engine relies on, Batch 6)
"""
from datetime import datetime, timedelta, timezone

from app.schemas.event import EventIngest

ALLOWED_SOURCES = {"auth", "network", "dns", "endpoint", "firewall", "application"}

MAX_FUTURE_SKEW = timedelta(minutes=5)
MAX_PAST_AGE = timedelta(days=730)


class EventValidationError(Exception):
    """Raised when an ingested event fails business-rule validation."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


def normalize_timestamp(value: datetime) -> datetime:
    """Ensure a timestamp is timezone-aware, assuming UTC if naive."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def validate_ingest_event(event: EventIngest) -> list[str]:
    """Return a list of human-readable validation errors (empty if valid)."""
    errors: list[str] = []

    if event.source.lower() not in ALLOWED_SOURCES:
        errors.append(
            f"Unknown source '{event.source}'. Allowed sources: {sorted(ALLOWED_SOURCES)}."
        )

    now = datetime.now(timezone.utc)
    ts = normalize_timestamp(event.timestamp)

    if ts > now + MAX_FUTURE_SKEW:
        errors.append(
            f"Event timestamp {ts.isoformat()} is more than "
            f"{int(MAX_FUTURE_SKEW.total_seconds() // 60)} minutes in the future."
        )

    if ts < now - MAX_PAST_AGE:
        errors.append(
            f"Event timestamp {ts.isoformat()} is more than {MAX_PAST_AGE.days} days in the past."
        )

    return errors