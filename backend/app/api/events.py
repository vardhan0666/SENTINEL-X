"""
Event ingestion & retrieval API.

Ingestion routes (POST) require ANALYST or ADMIN role, since accepting
telemetry into the platform is a privileged action. Retrieval routes (GET)
are available to any authenticated user, including VIEWER.

As of Batch 10, every successful ingestion schedules a background pipeline
run (app.services.pipeline.run_full_pipeline_for_event_id) that performs
rule-based detection, ML anomaly detection, correlation, and incident
creation/update for that event. The HTTP response is returned as soon as
the event itself is persisted — pipeline processing happens afterward and
is reflected on the dashboard via the WebSocket broadcast channel
(app/api/ws.py) once complete.
"""
import json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_role
from app.ingestion.ingestion_service import (
    DuplicateEventError,
    ingest_batch,
    ingest_canonical_event,
    ingest_raw_event,
)
from app.ingestion.normalizers import NORMALIZER_REGISTRY
from app.ingestion.validators import EventValidationError
from app.models.event import Event
from app.models.user import UserRole
from app.schemas.common import PaginatedResponse
from app.schemas.event import EventBatchIngest, EventIngest, EventIngestResponse, EventRead
from app.services.pipeline import run_full_pipeline_for_event_id

router = APIRouter(prefix="/events", tags=["events"])

_require_ingest_role = require_role(UserRole.ADMIN, UserRole.ANALYST)


@router.post("", response_model=EventRead, status_code=status.HTTP_201_CREATED)
async def ingest_event(
    payload: EventIngest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(_require_ingest_role),
) -> Event:
    try:
        event = await ingest_canonical_event(db, payload)
    except EventValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors)
    except DuplicateEventError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    background_tasks.add_task(run_full_pipeline_for_event_id, event.event_id)
    return event


@router.post("/batch", response_model=EventIngestResponse)
async def ingest_events_batch(
    payload: EventBatchIngest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(_require_ingest_role),
) -> EventIngestResponse:
    result = await ingest_batch(db, payload.events)
    for event_id in result.accepted_event_ids:
        background_tasks.add_task(run_full_pipeline_for_event_id, event_id)
    return result


@router.post("/raw/{source}", response_model=EventRead, status_code=status.HTTP_201_CREATED)
async def ingest_raw(
    source: str,
    background_tasks: BackgroundTasks,
    raw_event: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(_require_ingest_role),
) -> Event:
    if source.lower() not in NORMALIZER_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No normalizer registered for source '{source}'. "
                f"Available sources: {sorted(NORMALIZER_REGISTRY.keys())}"
            ),
        )
    try:
        event = await ingest_raw_event(db, source, raw_event)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except EventValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors)
    except DuplicateEventError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    background_tasks.add_task(run_full_pipeline_for_event_id, event.event_id)
    return event


@router.post("/upload", response_model=EventIngestResponse)
async def upload_events_file(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(_require_ingest_role),
) -> EventIngestResponse:
    """
    Ingest a JSON file containing either a bare list of canonical events or
    an object of the form {"events": [...]}. Each item is validated against
    the EventIngest schema individually; malformed items are reported in
    the response without aborting ingestion of the rest of the file.
    """
    raw_bytes = await file.read()
    try:
        parsed = json.loads(raw_bytes)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Uploaded file is not valid JSON: {exc}"
        )

    raw_items = parsed.get("events") if isinstance(parsed, dict) else parsed
    if not isinstance(raw_items, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded JSON must be a list of events or an object with an 'events' list.",
        )

    payloads: list[EventIngest] = []
    parse_errors: list[str] = []
    for index, item in enumerate(raw_items):
        try:
            payloads.append(EventIngest.model_validate(item))
        except Exception as exc:  # noqa: BLE001 - surfaced as a per-item ingestion error, not a crash
            parse_errors.append(f"item[{index}]: {exc}")

    result = await ingest_batch(db, payloads)
    result.rejected += len(parse_errors)
    result.errors.extend(parse_errors)

    for event_id in result.accepted_event_ids:
        background_tasks.add_task(run_full_pipeline_for_event_id, event_id)

    return result


@router.get("", response_model=PaginatedResponse[EventRead])
async def list_events(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    source: Optional[str] = None,
    source_ip: Optional[str] = None,
    hostname: Optional[str] = None,
    username: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PaginatedResponse[EventRead]:
    filters = []
    if severity:
        filters.append(Event.severity == severity.lower())
    if event_type:
        filters.append(Event.event_type == event_type)
    if source:
        filters.append(Event.source == source.lower())
    if source_ip:
        filters.append(Event.source_ip == source_ip)
    if hostname:
        filters.append(Event.hostname == hostname)
    if username:
        filters.append(Event.username == username)
    if start_time:
        filters.append(Event.timestamp >= start_time)
    if end_time:
        filters.append(Event.timestamp <= end_time)

    count_query = select(func.count()).select_from(Event)
    for condition in filters:
        count_query = count_query.where(condition)
    total = (await db.execute(count_query)).scalar_one()

    query = select(Event).order_by(Event.timestamp.desc()).limit(limit).offset(offset)
    for condition in filters:
        query = query.where(condition)
    events = (await db.execute(query)).scalars().all()

    return PaginatedResponse(items=list(events), total=total, limit=limit, offset=offset)


@router.get("/{event_id}", response_model=EventRead)
async def get_event(
    event_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Event:
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return event