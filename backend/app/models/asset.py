"""
Asset model — monitored hosts/servers used for asset-criticality-aware
risk scoring (see app/risk/factors.py, Batch 7).
"""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class AssetCriticality(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hostname: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True, index=True)
    asset_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    criticality: Mapped[AssetCriticality] = mapped_column(
        SAEnum(AssetCriticality, name="asset_criticality"),
        default=AssetCriticality.MEDIUM,
        nullable=False,
    )
    owner: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Asset id={self.id} hostname={self.hostname} criticality={self.criticality.value}>"