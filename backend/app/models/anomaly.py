"""
AnomalyResult model — output of the ML anomaly engine (app/ml/*, Batch 8).

Every windowed feature computation for a monitored entity (source IP,
username, or hostname) is recorded here, whether or not it crossed the
anomaly threshold. Only results that *do* cross the threshold get linked
to a Detection row (detection_id populated) so the dashboard can render
the underlying evidence for an ML-flagged alert.
"""
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class AnomalyResult(Base):
    __tablename__ = "anomaly_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # One of: SOURCE_IP, USERNAME, HOSTNAME
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    entity_value: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    feature_snapshot: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    anomaly_score: Mapped[float] = mapped_column(Float, nullable=False)
    is_anomalous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    baseline_mean: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )

    # Unique + nullable: at most one AnomalyResult maps to a given Detection.
    detection_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("detections.id"), nullable=True, unique=True, index=True
    )
    detection: Mapped[Optional["Detection"]] = relationship("Detection", back_populates="anomaly_result")

    def __repr__(self) -> str:
        return f"<AnomalyResult entity={self.entity_type}:{self.entity_value} score={self.anomaly_score:.3f}>"