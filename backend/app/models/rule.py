"""
Rule model — configuration for detection rules (app/detection/*, Batch 6).

Rules are seeded into this table at startup/migration time with sane
defaults, but thresholds and enabled/disabled state are analyst-configurable
at runtime via the /api/v1/rules endpoint without requiring a redeploy.
"""
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    default_severity: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
    threshold_config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    detections: Mapped[list["Detection"]] = relationship("Detection", back_populates="rule")

    def __repr__(self) -> str:
        return f"<Rule rule_key={self.rule_key} enabled={self.enabled}>"