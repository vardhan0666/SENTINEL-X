"""
Detection retrieval and manual-evaluation API.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_role
from app.detection.detection_service import query_detections, run_detection_for_event
from app.models.detection import Detection, DetectionType
from app.models.event import Event
from app.models.user import UserRole
from app.schemas.common import PaginatedResponse
from app.schemas.detection import DetectionExplanation, DetectionRead

router = APIRouter(prefix="/detections", tags=["detections"])


@router.get("", response_model=PaginatedResponse[DetectionRead])
async def list_detections(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    severity: Optional[str] = None,
    category: Optional[str] = None,
    detection_type: Optional[DetectionType] = None,
    rule_key: Optional[str] = None,
    source_ip: Optional[str] = None,
    username: Optional[str] = None,
    hostname: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PaginatedResponse[DetectionRead]:
    detections, total = await query_detections(
        db,
        severity=severity,
        category=category,
        detection_type=detection_type,
        rule_key=rule_key,
        source_ip=source_ip,
        username=username,
        hostname=hostname,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse(items=detections, total=total, limit=limit, offset=offset)


@router.get("/{detection_id}", response_model=DetectionRead)
async def get_detection(
    detection_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
) -> Detection:
    result = await db.execute(select(Detection).where(Detection.id == detection_id))
    detection = result.scalar_one_or_none()
    if detection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Detection not found.")
    return detection


@router.get("/{detection_id}/explain", response_model=DetectionExplanation)
async def explain_detection(
    detection_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
) -> DetectionExplanation:
    result = await db.execute(select(Detection).where(Detection.id == detection_id))
    detection = result.scalar_one_or_none()
    if detection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Detection not found.")

    evidence = detection.evidence or {}
    recommended_action = evidence.get(
        "recommended_action", "Review the related events and escalate if warranted."
    )
    method = (
        "Rule-based detection"
        if detection.detection_type == DetectionType.RULE
        else "ML anomaly detection (Isolation Forest / statistical baseline)"
    )

    return DetectionExplanation(
        detection=detection.title,
        method=method,
        confidence=detection.confidence,
        reason=detection.reason,
        evidence=evidence.get("event_ids", []),
        recommended_action=recommended_action,
    )


@router.post(
    "/evaluate/{event_id}",
    response_model=list[DetectionRead],
    status_code=status.HTTP_201_CREATED,
)
async def evaluate_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_role(UserRole.ADMIN, UserRole.ANALYST)),
) -> list[Detection]:
    """
    Manually trigger rule-based detection evaluation for a stored event.

    NOTE: Starting in Batch 10, this evaluation runs automatically as part
    of the ingestion pipeline for every newly ingested event. Until that
    wiring lands, this endpoint is the mechanism for running detection
    against ingested telemetry (including simulator-generated scenarios).
    It also remains useful afterward for re-running detection once rule
    thresholds have been changed via PATCH /rules/{rule_key}.
    """
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    return await run_detection_for_event(db, event)