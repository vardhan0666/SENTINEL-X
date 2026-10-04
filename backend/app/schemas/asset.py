"""
Pydantic schemas for Asset resources.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.asset import AssetCriticality


class AssetBase(BaseModel):
    hostname: str = Field(..., max_length=255)
    ip_address: Optional[str] = None
    asset_type: Optional[str] = None
    criticality: AssetCriticality = AssetCriticality.MEDIUM
    owner: Optional[str] = None


class AssetCreate(AssetBase):
    pass


class AssetRead(AssetBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime