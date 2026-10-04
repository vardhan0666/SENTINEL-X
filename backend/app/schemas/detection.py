"""
Pydantic schemas for Detection resources.

Distinguishes RULE detections from ML_ANOMALY detections per the project's
explainability and AI-transparency requirements (see docs/DETECTION_ENGINE.md
and docs/ML.md, added in later batches).
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict

from app.models.detection import DetectionType


class DetectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    rule_key: Optional[str] = None
    detection_type: DetectionType
    title: str
    category: str
    severity: str
    confidence: float
    reason: str
    evidence: Optional[dict[str, Any]] = None
    source_ip: Optional[str] = None
    username: Optional[str] = None
    hostname: Optional[str] = None
    created_at: datetime
    correlation_group_id: Optional[str] = None


class DetectionExplanation(BaseModel):
    """
    Structured explainability payload, mirroring the format required by
    the project specification (Section 11): what happened, why, evidence,
    confidence, and the recommended next step.
    """

    detection: str
    method: str
    confidence: float
    reason: str
    evidence: list[Any]
    recommended_action: str