"""
Pydantic schemas for security events.

EventIngest is intentionally permissive — only the framing fields required
by every telemetry source (event_id, timestamp, source, event_type,
severity) are mandatory. All canonical fields beyond that are optional,
since different sources populate different subsets. The normalization
engine (app/ingestion/normalizers/*, Batch 5) is responsible for producing
a fully-formed canonical Event from whatever subset of fields the source
actually supplied.
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_SEVERITIES = {"low", "medium", "high", "critical"}


class EventIngest(BaseModel):
    event_id: str = Field(..., min_length=1, max_length=128)
    timestamp: datetime
    source: str = Field(..., min_length=1, max_length=64)
    event_type: str = Field(..., min_length=1, max_length=128)
    severity: str

    category: Optional[str] = None
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    source_port: Optional[int] = Field(None, ge=0, le=65535)
    destination_port: Optional[int] = Field(None, ge=0, le=65535)
    protocol: Optional[str] = None
    username: Optional[str] = None
    hostname: Optional[str] = None
    process_name: Optional[str] = None
    action: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = Field(None, max_length=1024)
    metadata: Optional[dict[str, Any]] = Field(default_factory=dict)

    @field_validator("severity")
    @classmethod
    def _validate_severity(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in ALLOWED_SEVERITIES:
            raise ValueError(f"severity must be one of {sorted(ALLOWED_SEVERITIES)}")
        return normalized


class EventBatchIngest(BaseModel):
    events: list[EventIngest] = Field(..., min_length=1, max_length=1000)


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    timestamp: datetime
    ingested_at: datetime
    source: str
    category: Optional[str] = None
    event_type: str
    severity: str
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    source_port: Optional[int] = None
    destination_port: Optional[int] = None
    protocol: Optional[str] = None
    username: Optional[str] = None
    hostname: Optional[str] = None
    process_name: Optional[str] = None
    action: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None

    # The ORM attribute is named `event_metadata` (see app/models/event.py,
    # to avoid colliding with SQLAlchemy's reserved Base.metadata), but the
    # API contract exposes it as `metadata` for API consumers.
    metadata: Optional[dict[str, Any]] = Field(
        default=None, validation_alias="event_metadata", serialization_alias="metadata"
    )


class EventIngestResponse(BaseModel):
    accepted: int
    rejected: int
    errors: list[str] = Field(default_factory=list)
    # Populated by app.ingestion.ingestion_service.ingest_batch so callers
    # (app/api/events.py) can schedule a pipeline run for each accepted
    # event without an extra database round-trip.
    accepted_event_ids: list[str] = Field(default_factory=list)