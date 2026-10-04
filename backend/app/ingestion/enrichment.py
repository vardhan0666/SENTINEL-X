"""
Event enrichment: attaches local context (asset criticality, indicator
matches) to an incoming canonical event before it is persisted.

This enrichment is intentionally lightweight and local-only, consistent
with the project's defensive/local-lab scope: no external threat
intelligence lookups are performed — only the local `assets` and
`indicators` tables (see app/models/asset.py, app/models/indicator.py).
"""
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.indicator import Indicator, IndicatorType
from app.schemas.event import EventIngest


async def enrich_event(db: AsyncSession, event: EventIngest) -> dict[str, Any]:
    """
    Compute enrichment data for an event. Returns an empty dict if nothing
    relevant was found — enrichment is additive and never blocks ingestion.
    """
    enrichment: dict[str, Any] = {}

    if event.hostname:
        result = await db.execute(
            select(Asset).where(func.lower(Asset.hostname) == event.hostname.lower())
        )
        asset = result.scalar_one_or_none()
        if asset:
            enrichment["asset_criticality"] = asset.criticality.value
            if asset.owner:
                enrichment["asset_owner"] = asset.owner

    matched_indicators: list[dict[str, Any]] = []
    for field_name, ip_value in (
        ("source_ip", event.source_ip),
        ("destination_ip", event.destination_ip),
    ):
        if not ip_value:
            continue
        result = await db.execute(
            select(Indicator).where(Indicator.type == IndicatorType.IP, Indicator.value == ip_value)
        )
        indicator = result.scalar_one_or_none()
        if indicator:
            matched_indicators.append(
                {
                    "field": field_name,
                    "value": ip_value,
                    "risk_level": indicator.risk_level,
                    "description": indicator.description,
                }
            )

    if matched_indicators:
        enrichment["matched_indicators"] = matched_indicators

    return enrichment