"""
Pydantic schemas for simulated defensive response actions.

Per project scope, every response action is a SIMULATION. `simulated` is
always True in stored records and API responses.
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict

from app.models.response_action import ResponseActionStatus, ResponseActionType


class ResponseActionCreate(BaseModel):
    action_type: ResponseActionType
    notes: Optional[str] = None


class ResponseActionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: str
    action_type: ResponseActionType
    status: ResponseActionStatus
    simulated: bool
    performed_by: Optional[str] = None
    details: Optional[dict[str, Any]] = None
    created_at: datetime