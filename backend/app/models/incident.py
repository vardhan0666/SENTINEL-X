"""
Incident model, incident lifecycle status, and the incident<->event /
incident<->detection association tables.

Incidents are the analyst-facing case record produced by
app/services/incident_service.py (Batch 9), typically from a
CorrelationGroup once its aggregate risk score crosses a threshold.
"""
import enum
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Column, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, JSON, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, generate_uuid, utcnow


class IncidentStatus(str, enum.Enum):
    NEW = "NEW"
    INVESTIGATING = "INVESTIGATING"
    CONTAINED = "CONTAINED"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"


incident_events = Table(
    "incident_events",
    Base.metadata,
    Column("incident_id", String(36), ForeignKey("incidents.id"), primary_key=True),
    Column("event_id", String(36), ForeignKey("events.id"), primary_key=True),
)

incident_detections = Table(
    "incident_detections",
    Base.metadata,
    Column("incident_id", String(36), ForeignKey("incidents.id"), primary_key=True),
    Column("detection_id", String(36), ForeignKey("detections.id"), primary_key=True),
)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[IncidentStatus] = mapped_column(
        SAEnum(IncidentStatus, name="incident_status"), default=IncidentStatus.NEW, nullable=False, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    correlation_group_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("correlation_groups.id"), nullable=True, index=True
    )
    correlation_group: Mapped[Optional["CorrelationGroup"]] = relationship(
        "CorrelationGroup", back_populates="incidents"
    )

    # Structured explainability payload: what happened, why, risk factors,
    # detection method, confidence (see app/services/incident_service.py).
    explanation: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    recommended_actions: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    analyst_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    assigned_to: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    assigned_to_user: Mapped[Optional["User"]] = relationship(
        "User", back_populates="assigned_incidents", foreign_keys=[assigned_to]
    )

    events: Mapped[list["Event"]] = relationship("Event", secondary=incident_events, backref="incidents")
    detections: Mapped[list["Detection"]] = relationship(
        "Detection", secondary=incident_detections, backref="incidents"
    )
    response_actions: Mapped[list["ResponseAction"]] = relationship(
        "ResponseAction", back_populates="incident"
    )

    def __repr__(self) -> str:
        return f"<Incident id={self.id} status={self.status.value} risk_score={self.risk_score}>"