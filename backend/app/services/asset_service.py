"""
Asset management service: monitored hosts/servers used for
asset-criticality-aware risk scoring (app.risk.factors) and enrichment
(app.ingestion.enrichment).
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.schemas.asset import AssetCreate


async def list_assets(db: AsyncSession) -> list[Asset]:
    result = await db.execute(select(Asset).order_by(Asset.hostname))
    return list(result.scalars().all())


async def get_asset(db: AsyncSession, asset_id: int) -> Optional[Asset]:
    return await db.get(Asset, asset_id)


async def get_asset_by_hostname(db: AsyncSession, hostname: str) -> Optional[Asset]:
    result = await db.execute(select(Asset).where(Asset.hostname == hostname))
    return result.scalar_one_or_none()


async def create_asset(db: AsyncSession, payload: AssetCreate) -> Asset:
    asset = Asset(**payload.model_dump())
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset