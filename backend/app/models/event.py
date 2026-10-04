"""
Event model — the canonical, normalized security event.

Every telemetry record, regardless of original source format, is converted
by the normalization engine (app/ingestion/normalizers/*, Batch 5) into this
shape before being persisted here. This is the single source of truth
consumed by the detection, correlation, risk, and ML engines.

NOTE: the `metadata` database column is exposed as `event_metadata` on the
Python side because `metadata` is a reserved attribute name on SQLAlchemy
declarative classes (it refers to Base.metadata).
"""
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Index, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, generate_uuid, utcnow


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)

    # External event identifier, as supplied by the ingesting source (or the
    # simulator). Must be unique so re-ingesting the same payload is rejected.
    event_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    source: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)

    source_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True, index=True)
    destination_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True, index=True)
    source_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    destination_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    protocol: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

    username: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    hostname: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    process_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    action: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    event_metadata: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, name="metadata", nullable=True)
    raw_payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_events_source_ip_timestamp", "source_ip", "timestamp"),
        Index("ix_events_username_timestamp", "username", "timestamp"),
        Index("ix_events_hostname_timestamp", "hostname", "timestamp"),
    )

    def __repr__(self) -> str:
        return f"<Event id={self.id} event_type={self.event_type} severity={self.severity}>"