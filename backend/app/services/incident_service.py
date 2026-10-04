"""
Incident management service.

Creates and maintains Incident records from correlated (or standalone,
sufficiently risky) Detection rows, once their aggregate risk score
crosses INCIDENT_RISK_THRESHOLD. This is the bridge between the
detection/correlation/risk engines and the analyst-facing incident
lifecycle.

The incident<->detection and incident<->event association writes are
performed explicitly with PostgreSQL ON CONFLICT DO NOTHING so repeated
or concurrent pipeline evaluations are idempotent and cannot fail on
the composite primary keys of the association tables.
"""

import logging
from dataclasses import asdict
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.websocket_manager import manager
from app.models.detection import CorrelationGroup, Detection
from app.models.event import Event
from app.models.incident import (
    Incident,
    IncidentStatus,
    incident_detections,
    incident_events,
)
from app.risk.scoring import RiskScoreResult, calculate_risk_score
from app.schemas.incident import IncidentRead

logger = logging.getLogger("sentinelx.incidents")

# Medium-risk incidents start at 30.
INCIDENT_RISK_THRESHOLD = 30.0


async def _get_group_detections(
    db: AsyncSession,
    correlation_group_id: str,
) -> list[Detection]:
    result = await db.execute(
        select(Detection).where(
            Detection.correlation_group_id == correlation_group_id
        )
    )
    return list(result.scalars().all())


async def _find_existing_incident_for_group(
    db: AsyncSession,
    correlation_group_id: str,
) -> Optional[Incident]:
    result = await db.execute(
        select(Incident)
        .options(
            selectinload(Incident.events),
            selectinload(Incident.detections),
        )
        .where(Incident.correlation_group_id == correlation_group_id)
        .order_by(Incident.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()


async def _find_existing_incident_for_detection(
    db: AsyncSession,
    detection_id: str,
) -> Optional[Incident]:
    result = await db.execute(
        select(Incident)
        .options(
            selectinload(Incident.events),
            selectinload(Incident.detections),
        )
        .join(incident_detections, incident_detections.c.incident_id == Incident.id)
        .where(
            incident_detections.c.detection_id == detection_id,
            Incident.correlation_group_id.is_(None),
        )
        .order_by(Incident.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()


async def _collect_related_events(
    db: AsyncSession,
    detections: list[Detection],
) -> list[Event]:
    event_ids: set[str] = set()

    for detection in detections:
        evidence = detection.evidence or {}

        for event_id in evidence.get("event_ids", []):
            if event_id:
                event_ids.add(str(event_id))

    if not event_ids:
        return []

    result = await db.execute(
        select(Event).where(Event.event_id.in_(event_ids))
    )
    return list(result.scalars().all())


async def _reload_incident(
    db: AsyncSession,
    incident_id: str,
) -> Incident:
    """
    Reload the incident with its relationships after association writes.
    This avoids returning a stale ORM relationship collection.
    """
    result = await db.execute(
        select(Incident)
        .options(
            selectinload(Incident.events),
            selectinload(Incident.detections),
        )
        .where(Incident.id == incident_id)
    )

    incident = result.scalars().first()

    if incident is None:
        raise RuntimeError(
            f"Incident {incident_id} disappeared after persistence."
        )

    return incident


async def _attach_detections(
    db: AsyncSession,
    incident_id: str,
    detections: list[Detection],
) -> None:
    """
    Idempotently attach detections to an incident.

    PostgreSQL ON CONFLICT DO NOTHING makes this safe when two pipeline
    evaluations attempt to attach the same detection concurrently.
    """
    detection_ids = {
        detection.id
        for detection in detections
        if detection.id
    }

    if not detection_ids:
        return

    rows = [
        {
            "incident_id": incident_id,
            "detection_id": detection_id,
        }
        for detection_id in detection_ids
    ]

    statement = (
        insert(incident_detections)
        .values(rows)
        .on_conflict_do_nothing(
            index_elements=[
                incident_detections.c.incident_id,
                incident_detections.c.detection_id,
            ]
        )
    )

    await db.execute(statement)


async def _attach_events(
    db: AsyncSession,
    incident_id: str,
    events: list[Event],
) -> None:
    """
    Idempotently attach events to an incident.

    This uses the same conflict-safe strategy as detection associations,
    preventing duplicate composite-primary-key failures.
    """
    event_ids = {
        event.id
        for event in events
        if event.id
    }

    if not event_ids:
        return

    rows = [
        {
            "incident_id": incident_id,
            "event_id": event_id,
        }
        for event_id in event_ids
    ]

    statement = (
        insert(incident_events)
        .values(rows)
        .on_conflict_do_nothing(
            index_elements=[
                incident_events.c.incident_id,
                incident_events.c.event_id,
            ]
        )
    )

    await db.execute(statement)


def _build_explanation(
    detections: list[Detection],
    risk_result: RiskScoreResult,
) -> dict:
    return {
        "summary": (
            f"{len(detections)} related detection(s) produced an aggregate "
            f"risk score of {risk_result.total_score} "
            f"({risk_result.risk_level})."
        ),
        "risk_factors": {
            name: asdict(breakdown)
            for name, breakdown in risk_result.factors.items()
        },
        "contributing_detections": [
            {
                "id": detection.id,
                "title": detection.title,
                "detection_type": detection.detection_type.value,
                "category": detection.category,
                "severity": detection.severity,
                "confidence": detection.confidence,
                "reason": detection.reason,
            }
            for detection in detections
        ],
    }


def _derive_recommended_actions(
    detections: list[Detection],
) -> dict:
    actions: list[str] = []

    for detection in detections:
        evidence = detection.evidence or {}
        action_text = evidence.get("recommended_action")

        if action_text and action_text not in actions:
            actions.append(action_text)

    if not actions:
        actions.append(
            "Review the related events and escalate if warranted."
        )

    return {"actions": actions}


async def evaluate_detection_for_incident(
    db: AsyncSession,
    detection: Detection,
) -> Optional[Incident]:
    """
    Determine whether `detection` and any detections correlated with it
    warrant creating or updating an Incident.

    Returns None when:
      - no usable detections are available, or
      - aggregate risk is below INCIDENT_RISK_THRESHOLD.
    """
    group: Optional[CorrelationGroup] = None

    if detection.correlation_group_id:
        group = await db.get(
            CorrelationGroup,
            detection.correlation_group_id,
        )

        detections = await _get_group_detections(
            db,
            detection.correlation_group_id,
        )

        # Defensive fallback:
        # the group may temporarily contain no rows because of transaction
        # ordering/race conditions while the triggering detection exists.
        if not detections:
            detections = [detection]
    else:
        detections = [detection]

    # Prevent the risk scorer from receiving an empty list.
    if not detections:
        logger.warning(
            "Skipping incident evaluation because no detections are "
            "available for detection %s.",
            detection.id,
        )
        return None

    risk_result = await calculate_risk_score(
        db,
        detections,
    )

    if risk_result.total_score < INCIDENT_RISK_THRESHOLD:
        logger.info(
            "Risk score %.1f for detection %s is below the incident "
            "threshold (%.1f) — no incident created.",
            risk_result.total_score,
            detection.id,
            INCIDENT_RISK_THRESHOLD,
        )
        return None

    if group:
        existing = await _find_existing_incident_for_group(
            db,
            group.id,
        )
    else:
        existing = await _find_existing_incident_for_detection(
            db,
            detection.id,
        )

    related_events = await _collect_related_events(
        db,
        detections,
    )

    if existing:
        return await _update_incident(
            db,
            existing,
            detections,
            related_events,
            risk_result,
        )

    return await _create_incident(
        db,
        detections,
        related_events,
        risk_result,
        group,
    )


async def _create_incident(
    db: AsyncSession,
    detections: list[Detection],
    related_events: list[Event],
    risk_result: RiskScoreResult,
    group: Optional[CorrelationGroup],
) -> Incident:
    if not detections:
        raise ValueError(
            "Cannot create an incident without at least one detection."
        )

    title = (
        group.title
        if group is not None
        else detections[0].title
    )

    incident = Incident(
        title=title,
        severity=risk_result.risk_level,
        risk_score=risk_result.total_score,
        status=IncidentStatus.NEW,
        correlation_group_id=(
            group.id if group is not None else None
        ),
        explanation=_build_explanation(
            detections,
            risk_result,
        ),
        recommended_actions=_derive_recommended_actions(
            detections,
        ),
    )

    db.add(incident)

    # Get the incident ID before writing association rows.
    await db.flush()

    await _attach_detections(
        db,
        incident.id,
        detections,
    )

    await _attach_events(
        db,
        incident.id,
        related_events,
    )

    await db.commit()

    incident = await _reload_incident(
        db,
        incident.id,
    )

    logger.info(
        "Created incident %s ('%s') with risk score %.1f (%s).",
        incident.id,
        incident.title,
        incident.risk_score,
        incident.severity,
    )

    await _broadcast_incident_event(
        "incident.created",
        incident,
    )

    return incident


async def _update_incident(
    db: AsyncSession,
    incident: Incident,
    detections: list[Detection],
    related_events: list[Event],
    risk_result: RiskScoreResult,
) -> Incident:
    if not detections:
        logger.warning(
            "Skipping incident %s update because no detections "
            "were supplied.",
            incident.id,
        )
        return incident

    incident.risk_score = risk_result.total_score
    incident.severity = risk_result.risk_level
    incident.explanation = _build_explanation(
        detections,
        risk_result,
    )
    incident.recommended_actions = _derive_recommended_actions(
        detections,
    )

    await db.flush()

    # Do not append directly to ORM many-to-many collections.
    # The direct SQL association writes are conflict-safe.
    await _attach_detections(
        db,
        incident.id,
        detections,
    )

    await _attach_events(
        db,
        incident.id,
        related_events,
    )

    await db.commit()

    incident = await _reload_incident(
        db,
        incident.id,
    )

    logger.info(
        "Updated incident %s with new risk score %.1f (%s).",
        incident.id,
        incident.risk_score,
        incident.severity,
    )

    await _broadcast_incident_event(
        "incident.updated",
        incident,
    )

    return incident


async def _broadcast_incident_event(
    event_type: str,
    incident: Incident,
) -> None:
    await manager.broadcast(
        {
            "type": event_type,
            "data": IncidentRead.model_validate(incident).model_dump(
                mode="json"
            ),
        }
    )