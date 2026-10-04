"""
Analyst-facing alert feed.

An "alert" in SENTINEL-X is the presentation of a Detection row
(rule-based or ML-based) surfaced for triage. This endpoint shares its
query logic with /detections (see app.detection.detection_service.query_detections);
the distinction between the two endpoints is one of dashboard framing —
/detections is the engineering/audit view, /alerts is the analyst triage
view — not a difference in underlying data.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.detection.detection_service import query_detections
from app.models.detection import DetectionType
from app.schemas.common import PaginatedResponse
from app.schemas.detection import DetectionRead as AlertRead

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=PaginatedResponse[AlertRead])
async def list_alerts(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    severity: Optional[str] = None,
    category: Optional[str] = None,
    detection_type: Optional[DetectionType] = None,
    source_ip: Optional[str] = None,
    username: Optional[str] = None,
    hostname: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PaginatedResponse[AlertRead]:
    detections, total = await query_detections(
        db,
        severity=severity,
        category=category,
        detection_type=detection_type,
        source_ip=source_ip,
        username=username,
        hostname=hostname,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse(items=detections, total=total, limit=limit, offset=offset)