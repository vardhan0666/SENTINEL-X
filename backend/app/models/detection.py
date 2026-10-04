"""
Detection and CorrelationGroup models.

CorrelationGroup is defined in this module (rather than a separate file)
because it exists solely to group Detection rows produced by the
correlation engine (app/correlation/*, Batch 7) — it has no independent
lifecycle of its own.

detection_type distinguishes rule-based detections from ML anomaly-based
detections, per the project's explicit requirement to never blur the two.
"""
import enum
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, generate_uuid, utcnow


class DetectionType(str, enum.Enum):
    RULE = "RULE"
    ML_ANOMALY = "ML_ANOMALY"


class CorrelationGroup(Base):
    __tablename__ = "correlation_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    correlation_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    detection_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    detections: Mapped[list["Detection"]] = relationship("Detection", back_populates="correlation_group")
    incidents: Mapped[list["Incident"]] = relationship("Incident", back_populates="correlation_group")

    def __repr__(self) -> str:
        return f"<CorrelationGroup id={self.id} key={self.correlation_key}>"


class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)

    # Nullable because ML_ANOMALY detections are not tied to a static rule.
    rule_key: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("rules.rule_key"), nullable=True, index=True
    )
    detection_type: Mapped[DetectionType] = mapped_column(
        SAEnum(DetectionType, name="detection_type"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)

    # Human-readable explanation, e.g. "17 failed authentication attempts
    # were observed from 10.0.0.25 within 120 seconds."
    reason: Mapped[str] = mapped_column(String(2048), nullable=False)

    # List of contributing event IDs + supporting raw values used to reach
    # this detection (see app/detection/base_rule.py, Batch 6).
    evidence: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    source_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    hostname: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )

    correlation_group_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("correlation_groups.id"), nullable=True, index=True
    )
    correlation_group: Mapped[Optional["CorrelationGroup"]] = relationship(
        "CorrelationGroup", back_populates="detections"
    )

    rule: Mapped[Optional["Rule"]] = relationship(
        "Rule",
        back_populates="detections",
        primaryjoin="Detection.rule_key==Rule.rule_key",
        foreign_keys=[rule_key],
    )

    anomaly_result: Mapped[Optional["AnomalyResult"]] = relationship(
        "AnomalyResult", back_populates="detection", uselist=False
    )

    def __repr__(self) -> str:
        return f"<Detection id={self.id} type={self.detection_type.value} severity={self.severity}>"