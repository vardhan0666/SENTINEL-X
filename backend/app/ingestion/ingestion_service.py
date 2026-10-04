"""
Ingestion orchestration service.

Coordinates validation, (optional) normalization, enrichment, persistence,
and real-time broadcast for incoming telemetry. This is the single entry
point every ingestion API route (app/api/events.py) goes through.

As of Batch 10, ingestion itself remains synchronous and returns as soon
as the event is persisted; the full detection -> correlation -> ML ->
incident pipeline (app.services.pipeline) is scheduled separately as a
FastAPI BackgroundTask by the API layer, so ingestion latency stays low
regardless of how much downstream processing a given event triggers.
"""
import logging
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import manager
from app.ingestion.enrichment import enrich_event
from app.ingestion.normalizers import get_normalizer
from app.ingestion.validators import EventValidationError, normalize_timestamp, validate_ingest_event
from app.models.event import Event
from app.schemas.event import EventIngest, EventIngestResponse, EventRead

logger = logging.getLogger("sentinelx.ingestion")

_CATEGORY_DEFAULTS = {
    "auth": "authentication",
    "network": "network",
    "dns": "dns",
    "endpoint": "endpoint",
    "firewall": "firewall",
    "application": "application",
}


class DuplicateEventError(Exception):
    """Raised when an event with the same external event_id already exists."""

    def __init__(self, event_id: str):
        self.event_id = event_id
        super().__init__(f"Event with event_id '{event_id}' already exists.")


def _default_category(source: str) -> str:
    return _CATEGORY_DEFAULTS.get(source.lower(), "uncategorized")


async def ingest_canonical_event(
    db: AsyncSession,
    payload: EventIngest,
    raw_payload: Optional[dict[str, Any]] = None,
) -> Event:
    """
    Validate, enrich, persist, and broadcast a single canonical event.

    Raises:
        EventValidationError: if business-rule validation fails.
        DuplicateEventError: if an event with the same event_id already exists.
    """
    errors = validate_ingest_event(payload)
    if errors:
        raise EventValidationError(errors)

    existing = await db.execute(select(Event).where(Event.event_id == payload.event_id))
    if existing.scalar_one_or_none() is not None:
        raise DuplicateEventError(payload.event_id)

    payload.timestamp = normalize_timestamp(payload.timestamp)

    enrichment = await enrich_event(db, payload)
    metadata = dict(payload.metadata or {})
    if enrichment:
        metadata["enrichment"] = enrichment

    event = Event(
        event_id=payload.event_id,
        timestamp=payload.timestamp,
        source=payload.source.lower(),
        category=payload.category or _default_category(payload.source),
        event_type=payload.event_type,
        severity=payload.severity,
        source_ip=payload.source_ip,
        destination_ip=payload.destination_ip,
        source_port=payload.source_port,
        destination_port=payload.destination_port,
        protocol=payload.protocol,
        username=payload.username,
        hostname=payload.hostname,
        process_name=payload.process_name,
        action=payload.action,
        status=payload.status,
        message=payload.message,
        event_metadata=metadata,
        raw_payload=raw_payload if raw_payload is not None else payload.model_dump(mode="json"),
    )

    db.add(event)
    await db.commit()
    await db.refresh(event)

    logger.info("Ingested event %s (%s / %s)", event.event_id, event.source, event.event_type)

    await manager.broadcast(
        {
            "type": "event.created",
            "data": EventRead.model_validate(event).model_dump(mode="json", by_alias=True),
        }
    )

    return event


async def ingest_raw_event(db: AsyncSession, source: str, raw_event: dict[str, Any]) -> Event:
    """
    Normalize a raw, source-specific payload into the canonical schema and
    ingest it.

    Raises:
        ValueError: if no normalizer exists for `source`, or the raw
            payload is missing fields the normalizer requires.
        EventValidationError / DuplicateEventError: see ingest_canonical_event.
    """
    normalizer = get_normalizer(source)
    canonical = normalizer.normalize(raw_event)
    return await ingest_canonical_event(db, canonical, raw_payload=raw_event)


async def ingest_batch(db: AsyncSession, payloads: list[EventIngest]) -> EventIngestResponse:
    """
    Ingest a batch of canonical events, continuing past individual failures
    so a single malformed event does not abort the whole batch.
    """
    accepted = 0
    rejected = 0
    errors: list[str] = []
    accepted_event_ids: list[str] = []

    for payload in payloads:
        try:
            event = await ingest_canonical_event(db, payload)
            accepted += 1
            accepted_event_ids.append(event.event_id)
        except (EventValidationError, DuplicateEventError) as exc:
            rejected += 1
            errors.append(f"{payload.event_id}: {exc}")

    return EventIngestResponse(
        accepted=accepted, rejected=rejected, errors=errors, accepted_event_ids=accepted_event_ids
    )