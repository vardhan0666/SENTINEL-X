"""
Local threat intelligence indicator service.

Per project scope, indicators are sourced exclusively from local/sample
data (see database/seed/seed_indicators.py) — no live external threat
intelligence integration exists.
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.indicator import Indicator, IndicatorType
from app.schemas.indicator import IndicatorCreate


async def list_indicators(db: AsyncSession, indicator_type: Optional[IndicatorType] = None) -> list[Indicator]:
    query = select(Indicator).order_by(Indicator.added_at.desc())
    if indicator_type:
        query = query.where(Indicator.type == indicator_type)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_indicator(db: AsyncSession, payload: IndicatorCreate) -> Indicator:
    indicator = Indicator(**payload.model_dump())
    db.add(indicator)
    await db.commit()
    await db.refresh(indicator)
    return indicator


async def find_ip_indicator(db: AsyncSession, ip_value: str) -> Optional[Indicator]:
    result = await db.execute(
        select(Indicator).where(Indicator.type == IndicatorType.IP, Indicator.value == ip_value)
    )
    return result.scalar_one_or_none()