"""
Pydantic schemas for local threat intelligence indicators.

Per project scope, indicators originate only from local/sample feeds —
no live external threat intelligence integration exists.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.indicator import IndicatorType


class IndicatorBase(BaseModel):
    type: IndicatorType
    value: str = Field(..., max_length=512)
    risk_level: str = "medium"
    description: Optional[str] = None


class IndicatorCreate(IndicatorBase):
    source: str = "local-sample-feed"


class IndicatorRead(IndicatorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    added_at: datetime