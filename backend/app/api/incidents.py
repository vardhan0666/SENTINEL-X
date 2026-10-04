"""
Incident management API.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import CurrentUser, require_role
from app.models.detection import Detection
from app.models.incident import Incident, IncidentStatus
from app.models.user import User, UserRole
from app.schemas.common import PaginatedResponse
from app.schemas.incident import (
    IncidentDetailRead,
    IncidentRead,
    IncidentRespondRequest,
    IncidentUpdate,
)
from app.schemas.response_action import ResponseActionRead
from app.services.audit_service import log_action
from app.services.incident_service import evaluate_detection_for_incident
from app.services.response_service import simulate_response_action

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=PaginatedResponse[IncidentRead])
async def list_incidents(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[IncidentStatus] = Query(None, alias="status"),
    severity: Optional[str] = None,
    assigned_to: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PaginatedResponse[IncidentRead]:
    filters = []
    if status_filter:
        filters.append(Incident.status == status_filter)
    if severity:
        filters.append(Incident.severity == severity.lower())
    if assigned_to:
        filters.append(Incident.assigned_to == assigned_to)

    count_query = select(func.count()).select_from(Incident)
    for condition in filters:
        count_query = count_query.where(condition)
    total = (await db.execute(count_query)).scalar_one()

    query = select(Incident).order_by(Incident.created_at.desc()).limit(limit).offset(offset)
    for condition in filters:
        query = query.where(condition)
    incidents = (await db.execute(query)).scalars().all()

    return PaginatedResponse(items=list(incidents), total=total, limit=limit, offset=offset)


@router.get("/{incident_id}", response_model=IncidentDetailRead)
async def get_incident(
    incident_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
) -> Incident:
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.events), selectinload(Incident.detections))
        .where(Incident.id == incident_id)
    )
    incident = result.scalar_one_or_none()
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")
    return incident


@router.patch("/{incident_id}", response_model=IncidentRead)
async def update_incident(
    incident_id: str,
    payload: IncidentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ANALYST)),
) -> Incident:
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(incident, field_name, value)

    await db.commit()
    await db.refresh(incident)

    await log_action(
        db,
        user_id=current_user.id,
        action="incident.updated",
        resource_type="incident",
        resource_id=incident.id,
        details=update_data,
        ip_address=request.client.host if request.client else None,
    )

    return incident


@router.post("/{incident_id}/respond", response_model=ResponseActionRead, status_code=status.HTTP_201_CREATED)
async def respond_to_incident(
    incident_id: str,
    payload: IncidentRespondRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ANALYST)),
):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    return await simulate_response_action(
        db,
        incident,
        payload.action_type,
        performed_by=current_user,
        notes=payload.notes,
        ip_address=request.client.host if request.client else None,
    )


@router.post("/evaluate/{detection_id}", response_model=Optional[IncidentRead])
async def evaluate_incident(
    detection_id: str,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_role(UserRole.ADMIN, UserRole.ANALYST)),
):
    """
    Manually trigger incident evaluation for a detection.

    NOTE: Starting in Batch 10, this evaluation runs automatically as part
    of the ingestion pipeline immediately after correlation. Until that
    wiring lands, this endpoint (mirroring the pattern established by
    POST /detections/evaluate/{event_id}) is the mechanism for creating
    incidents during manual or simulated testing, and it remains useful
    afterward for re-evaluation after rule/threshold changes.
    """
    result = await db.execute(select(Detection).where(Detection.id == detection_id))
    detection = result.scalar_one_or_none()
    if detection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Detection not found.")

    return await evaluate_detection_for_incident(db, detection)