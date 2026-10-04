"""
Pydantic schemas for detection Rule configuration.

Rules are seeded with defaults (Batch 6) but are analyst-configurable at
runtime through PATCH /api/v1/rules/{rule_key} without requiring a redeploy.
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class RuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rule_key: str
    name: str
    category: str
    description: Optional[str] = None
    enabled: bool
    default_severity: str
    threshold_config: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class RuleUpdate(BaseModel):
    enabled: Optional[bool] = None
    default_severity: Optional[str] = None
    threshold_config: Optional[dict[str, Any]] = None