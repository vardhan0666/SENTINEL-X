"""
ResponseAction model — SIMULATED defensive response actions.

Per project scope, no destructive or real enforcement action is ever taken.
`simulated` is always True and `status` values are explicitly prefixed with
SIMULATED_ so this is unambiguous everywhere the record is displayed.
"""
import enum
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class ResponseActionType(str, enum.Enum):
    INVESTIGATE_SOURCE_IP = "INVESTIGATE_SOURCE_IP"
    REVIEW_AUTH_LOGS = "REVIEW_AUTH_LOGS"
    ISOLATE_ENDPOINT = "ISOLATE_ENDPOINT"
    DISABLE_ACCOUNT = "DISABLE_ACCOUNT"
    ROTATE_CREDENTIALS = "ROTATE_CREDENTIALS"
    BLOCK_INDICATOR = "BLOCK_INDICATOR"
    INCREASE_MONITORING = "INCREASE_MONITORING"
    COLLECT_TELEMETRY = "COLLECT_TELEMETRY"


class ResponseActionStatus(str, enum.Enum):
    SIMULATED_SUCCESS = "SIMULATED_SUCCESS"
    SIMULATED_FAILED = "SIMULATED_FAILED"


class ResponseAction(Base):
    __tablename__ = "response_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    incident_id: Mapped[str] = mapped_column(String(36), ForeignKey("incidents.id"), nullable=False, index=True)
    incident: Mapped["Incident"] = relationship("Incident", back_populates="response_actions")

    action_type: Mapped[ResponseActionType] = mapped_column(
        SAEnum(ResponseActionType, name="response_action_type"), nullable=False
    )
    status: Mapped[ResponseActionStatus] = mapped_column(
        SAEnum(ResponseActionStatus, name="response_action_status"), nullable=False
    )
    simulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    performed_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    performed_by_user: Mapped[Optional["User"]] = relationship("User", back_populates="response_actions")

    details: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ResponseAction id={self.id} type={self.action_type.value} status={self.status.value}>"