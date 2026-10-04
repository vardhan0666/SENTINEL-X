"""
Pydantic schemas for ML anomaly detection results.
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class AnomalyResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: str
    entity_value: str
    feature_snapshot: Optional[dict[str, Any]] = None
    anomaly_score: float
    is_anomalous: bool
    model_version: str
    baseline_mean: Optional[dict[str, Any]] = None
    computed_at: datetime
    detection_id: Optional[str] = None