"""
Risk scoring engine.

Combines the risk factors defined in app.risk.factors into a single,
transparent 0-100 risk score using a fixed, documented set of weights:

    Factor                   Weight
    -----------------------  ------
    severity                 0.30
    frequency                0.15
    confidence                0.15
    detection_type            0.10
    correlation_strength       0.10
    asset_importance           0.10
    historical_repetition      0.10
    -----------------------  ------
    TOTAL                     1.00

    final_score = round(100 * sum(weight_i * factor_i))

Score bands (per project specification):
    0-29   -> low
    30-59  -> medium
    60-79  -> high
    80-100 -> critical

Every RiskScoreResult carries a full breakdown of each factor's raw value,
weight, and weighted contribution, so an analyst can see exactly why a
given score was produced — this breakdown is surfaced directly in the
incident explanation (see app.services.incident_service, Batch 9).

NOTE: This is intentionally NOT a machine-learned scoring model. Per the
project's explainability requirements, risk scoring must remain fully
auditable — an analyst can recompute this score by hand from the factor
breakdown alone.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset, AssetCriticality
from app.models.detection import Detection
from app.risk.factors import (
    asset_importance_factor,
    confidence_factor,
    correlation_strength_factor,
    detection_type_factor,
    frequency_factor,
    historical_repetition_factor,
    severity_factor,
)

WEIGHTS = {
    "severity": 0.30,
    "frequency": 0.15,
    "confidence": 0.15,
    "detection_type": 0.10,
    "correlation_strength": 0.10,
    "asset_importance": 0.10,
    "historical_repetition": 0.10,
}

HISTORICAL_LOOKBACK_HOURS = 24


@dataclass
class RiskFactorBreakdown:
    value: float
    weight: float
    contribution: float


@dataclass
class RiskScoreResult:
    total_score: float
    risk_level: str
    factors: dict[str, RiskFactorBreakdown] = field(default_factory=dict)


def classify_risk_level(score: float) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 30:
        return "medium"
    return "low"


async def _lookup_max_asset_criticality(db: AsyncSession, hostnames: set[str]) -> AssetCriticality:
    if not hostnames:
        return AssetCriticality.MEDIUM

    result = await db.execute(select(Asset).where(Asset.hostname.in_(hostnames)))
    assets = result.scalars().all()
    if not assets:
        return AssetCriticality.MEDIUM

    order = [AssetCriticality.LOW, AssetCriticality.MEDIUM, AssetCriticality.HIGH, AssetCriticality.CRITICAL]
    return max((asset.criticality for asset in assets), key=order.index)


async def _count_historical_related_detections(
    db: AsyncSession, detections: list[Detection], before: datetime
) -> int:
    conditions = []
    for detection in detections:
        if detection.source_ip:
            conditions.append(Detection.source_ip == detection.source_ip)
        if detection.username:
            conditions.append(Detection.username == detection.username)

    if not conditions:
        return 0

    lookback_start = before - timedelta(hours=HISTORICAL_LOOKBACK_HOURS)

    query = select(func.count(func.distinct(Detection.id))).where(
        Detection.created_at >= lookback_start,
        Detection.created_at < before,
        or_(*conditions),
    )
    return (await db.execute(query)).scalar_one()


async def calculate_risk_score(db: AsyncSession, detections: list[Detection]) -> RiskScoreResult:
    """
    Calculate a transparent, explainable risk score for a set of related
    detections (typically all detections within a single correlation
    group, or a single detection for a standalone incident).
    """
    if not detections:
        raise ValueError("calculate_risk_score requires at least one detection.")

    severities = [d.severity for d in detections]
    confidences = [d.confidence for d in detections]
    detection_types = [d.detection_type.value for d in detections]
    categories = [d.category for d in detections]
    hostnames = {d.hostname for d in detections if d.hostname}

    earliest_created_at = min(d.created_at for d in detections)

    raw_values = {
        "severity": severity_factor(severities),
        "frequency": frequency_factor(len(detections)),
        "confidence": confidence_factor(confidences),
        "detection_type": detection_type_factor(detection_types),
        "correlation_strength": correlation_strength_factor(categories),
        "asset_importance": asset_importance_factor(
            await _lookup_max_asset_criticality(db, hostnames)
        ),
        "historical_repetition": historical_repetition_factor(
            await _count_historical_related_detections(db, detections, earliest_created_at)
        ),
    }

    factors: dict[str, RiskFactorBreakdown] = {}
    total = 0.0
    for factor_name, weight in WEIGHTS.items():
        value = raw_values[factor_name]
        contribution = weight * value
        factors[factor_name] = RiskFactorBreakdown(
            value=round(value, 3), weight=weight, contribution=round(contribution, 4)
        )
        total += contribution

    total_score = round(min(100.0, max(0.0, total * 100)), 1)

    return RiskScoreResult(
        total_score=total_score,
        risk_level=classify_risk_level(total_score),
        factors=factors,
    )