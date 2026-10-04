"""
Full detection pipeline orchestrator.

Wires together, in order, every engine built in Batches 5-9:

    ingestion (already complete by the time this runs)
      -> rule-based detection            (app.detection.detection_service)
      -> ML anomaly detection            (app.ml.anomaly_service)
      -> correlation                     (app.correlation.correlation_engine)
      -> incident evaluation             (app.services.incident_service)

This module owns its own database session per invocation (rather than
reusing a request-scoped session) so it can safely run as a FastAPI
BackgroundTask *after* the ingestion HTTP response has already been sent
(see app/api/events.py) without racing the request session's teardown.
"""
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.correlation.correlation_engine import correlate_detection
from app.detection.detection_service import run_detection_for_event
from app.ml.anomaly_service import evaluate_entity_anomaly
from app.models.detection import Detection
from app.models.event import Event
from app.services.incident_service import evaluate_detection_for_incident

logger = logging.getLogger("sentinelx.pipeline")

_ENTITY_FIELDS = [
    ("SOURCE_IP", "source_ip"),
    ("USERNAME", "username"),
    ("HOSTNAME", "hostname"),
]


async def run_full_pipeline_for_event_id(event_id: str) -> None:
    """
    Entry point for background pipeline execution, looked up by the
    canonical (external) event_id rather than the internal UUID primary
    key, since that is what's readily available at every ingestion call
    site (app/api/events.py) without an extra round-trip.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Event).where(Event.event_id == event_id))
        event = result.scalar_one_or_none()
        if event is None:
            logger.warning("Pipeline invoked for unknown event_id '%s' — skipping.", event_id)
            return

        try:
            await _run_pipeline(db, event)
        except Exception:
            logger.exception("Pipeline execution failed for event %s.", event_id)


async def _run_pipeline(db: AsyncSession, event: Event) -> None:
    all_detections: list[Detection] = []

    # --- Stage 1: rule-based detection ---
    rule_detections = await run_detection_for_event(db, event)
    all_detections.extend(rule_detections)

    # --- Stage 2: ML anomaly detection, per populated entity on this event ---
    for entity_type, field_name in _ENTITY_FIELDS:
        entity_value = getattr(event, field_name)
        if not entity_value:
            continue
        anomaly_results = await evaluate_entity_anomaly(
            db, entity_type, entity_value, window_end=event.timestamp
        )
        for anomaly_result in anomaly_results:
            if anomaly_result.detection_id:
                detection = await db.get(Detection, anomaly_result.detection_id)
                if detection is not None:
                    all_detections.append(detection)

    if not all_detections:
        logger.debug("Pipeline found no detections for event %s.", event.event_id)
        return

    # --- Stage 3: correlation ---
    for detection in all_detections:
        if detection.correlation_group_id is None:
            await correlate_detection(db, detection)

    # --- Stage 4: incident evaluation ---
    evaluated_detection_ids: set[str] = set()
    for detection in all_detections:
        if detection.id in evaluated_detection_ids:
            continue
        evaluated_detection_ids.add(detection.id)
        await evaluate_detection_for_incident(db, detection)

    logger.info(
        "Pipeline completed for event %s: %d detection(s) processed.",
        event.event_id, len(all_detections),
    )