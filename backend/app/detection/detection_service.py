"""
Detection orchestration service.

run_detection_for_event() is the single entry point for evaluating every
enabled rule against a stored event. It is currently invoked:
  - manually, via POST /api/v1/detections/evaluate/{event_id}
    (app/api/detections.py, this batch)

Starting in Batch 10, app/services/pipeline.py will call this same function
automatically for every newly ingested event, as part of the full
ingestion -> detection -> correlation -> risk -> ML -> incident chain. No
speculative hook into app.ingestion.ingestion_service is added yet, per
the project's rule against referencing modules before they exist/are wired.
"""
import logging
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import manager
from app.detection.base_rule import DetectionContext
from app.detection.rule_registry import ALL_RULES
from app.models.detection import Detection, DetectionType
from app.models.event import Event
from app.models.rule import Rule
from app.schemas.detection import DetectionRead

logger = logging.getLogger("sentinelx.detection")


async def _load_enabled_rules(db: AsyncSession) -> dict[str, Rule]:
    result = await db.execute(select(Rule).where(Rule.enabled.is_(True)))
    return {row.rule_key: row for row in result.scalars().all()}


async def run_detection_for_event(db: AsyncSession, event: Event) -> list[Detection]:
    """
    Evaluate every registered, enabled detection rule against a single
    event, persisting and broadcasting any resulting Detection rows.

    Rules whose rule_key has no corresponding row in the `rules` table are
    skipped with a warning — every rule in
    app.detection.rule_registry.ALL_RULES is expected to have been seeded
    via `python -m database.seed.seed_rules`.
    """
    enabled_rules = await _load_enabled_rules(db)
    created: list[Detection] = []

    for rule_instance in ALL_RULES:
        rule_row = enabled_rules.get(rule_instance.rule_key)
        if rule_row is None:
            logger.warning(
                "Rule '%s' has no database row (not seeded) or is disabled — skipping.",
                rule_instance.rule_key,
            )
            continue

        config = dict(rule_row.threshold_config or rule_instance.default_threshold_config or {})
        config.setdefault("severity", rule_row.default_severity)

        context = DetectionContext(db=db, config=config)

        try:
            result = await rule_instance.evaluate(event, context)
        except Exception:
            logger.exception(
                "Rule '%s' raised an exception while evaluating event %s.",
                rule_instance.rule_key,
                event.event_id,
            )
            continue

        if result is None:
            continue

        detection = Detection(
            rule_key=result.rule_key,
            detection_type=DetectionType.RULE,
            title=result.title,
            category=result.category,
            severity=result.severity,
            confidence=result.confidence,
            reason=result.reason,
            evidence=result.evidence,
            source_ip=result.source_ip,
            username=result.username,
            hostname=result.hostname,
        )
        db.add(detection)
        await db.commit()
        await db.refresh(detection)
        created.append(detection)

        logger.info("Detection '%s' created for event %s.", detection.rule_key, event.event_id)

        await manager.broadcast(
            {
                "type": "detection.created",
                "data": DetectionRead.model_validate(detection).model_dump(mode="json"),
            }
        )

    return created


async def query_detections(
    db: AsyncSession,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    detection_type: Optional[DetectionType] = None,
    rule_key: Optional[str] = None,
    source_ip: Optional[str] = None,
    username: Optional[str] = None,
    hostname: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Detection], int]:
    """Shared, filterable query used by both /detections and /alerts."""
    filters = []
    if severity:
        filters.append(Detection.severity == severity.lower())
    if category:
        filters.append(Detection.category == category)
    if detection_type:
        filters.append(Detection.detection_type == detection_type)
    if rule_key:
        filters.append(Detection.rule_key == rule_key)
    if source_ip:
        filters.append(Detection.source_ip == source_ip)
    if username:
        filters.append(Detection.username == username)
    if hostname:
        filters.append(Detection.hostname == hostname)

    count_query = select(func.count()).select_from(Detection)
    for condition in filters:
        count_query = count_query.where(condition)
    total = (await db.execute(count_query)).scalar_one()

    query = select(Detection).order_by(Detection.created_at.desc()).limit(limit).offset(offset)
    for condition in filters:
        query = query.where(condition)
    detections = (await db.execute(query)).scalars().all()

    return list(detections), total