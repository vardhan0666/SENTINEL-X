"""
Pydantic schemas for Incident resources.
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.incident import IncidentStatus
from app.models.response_action import ResponseActionType
from app.schemas.detection import DetectionRead
from app.schemas.event import EventRead


class IncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    severity: str
    risk_score: float
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime
    correlation_group_id: Optional[str] = None
    explanation: Optional[dict[str, Any]] = None
    recommended_actions: Optional[dict[str, Any]] = None
    analyst_notes: Optional[str] = None
    assigned_to: Optional[str] = None


class IncidentDetailRead(IncidentRead):
    """Extended incident view including related events and detections."""

    events: list[EventRead] = Field(default_factory=list)
    detections: list[DetectionRead] = Field(default_factory=list)


class IncidentUpdate(BaseModel):
    status: Optional[IncidentStatus] = None
    analyst_notes: Optional[str] = None
    assigned_to: Optional[str] = None


class IncidentRespondRequest(BaseModel):
    """Request body for POST /incidents/{id}/respond — always simulated."""

    action_type: ResponseActionType
    notes: Optional[str] = None