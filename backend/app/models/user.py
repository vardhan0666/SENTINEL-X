"""
User model — analyst/administrator accounts for SENTINEL-X.

Authentication logic (hashing, JWT issuance) lives in app.core.security
and app.api.auth (Batch 4). This module only defines persistence.
"""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, generate_uuid, utcnow


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    ANALYST = "ANALYST"
    VIEWER = "VIEWER"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role"), nullable=False, default=UserRole.VIEWER
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # An analyst may be assigned to investigate multiple incidents.
    assigned_incidents: Mapped[list["Incident"]] = relationship(
        "Incident",
        back_populates="assigned_to_user",
        foreign_keys="Incident.assigned_to",
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="user")
    response_actions: Mapped[list["ResponseAction"]] = relationship(
        "ResponseAction", back_populates="performed_by_user"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} role={self.role.value}>"