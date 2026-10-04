"""
Statistical baseline anomaly detector.

Computes a per-entity historical baseline (mean/stddev) for the windowed
behavioral features in app.ml.feature_extraction, sampled from the
non-overlapping windows immediately preceding the current observation, and
flags a new observation as anomalous if it deviates from that baseline by
more than a configurable z-score threshold.

This is the "fast, transparent, no-training-required" half of SENTINEL-X's
anomaly detection story. Results are labeled with a distinct
STATISTICAL_BASELINE-style model_version, and — honestly — no anomaly
verdict is produced at all when there isn't enough historical data to
compute a stable baseline (see MIN_BUCKETS_FOR_BASELINE below).
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import mean, pstdev
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.feature_extraction import FEATURE_NAMES, extract_features_for_entity

logger = logging.getLogger("sentinelx.ml.baseline")

MIN_BUCKETS_FOR_BASELINE = 3


@dataclass
class BaselineResult:
    entity_type: str
    entity_value: str
    baseline_mean: dict[str, float]
    baseline_stddev: dict[str, float]
    bucket_count: int


async def compute_baseline(
    db: AsyncSession,
    entity_type: str,
    entity_value: str,
    window_end: datetime,
    feature_window_seconds: int = 300,
    bucket_count_target: int = 20,
) -> Optional[BaselineResult]:
    """
    Sample up to `bucket_count_target` non-overlapping windows of
    `feature_window_seconds` immediately preceding the current window
    (i.e. excluding it, so the observation cannot contaminate its own
    baseline), keeping only buckets with at least some activity.

    Returns None if fewer than MIN_BUCKETS_FOR_BASELINE active historical
    buckets are found — an honest signal that there is not yet enough
    history to judge "normal" for this entity.
    """
    buckets: list[dict[str, float]] = []
    bucket_end = window_end - timedelta(seconds=feature_window_seconds)

    for _ in range(bucket_count_target):
        bucket_start = bucket_end - timedelta(seconds=feature_window_seconds)
        features = await extract_features_for_entity(
            db, entity_type, entity_value, window_end=bucket_end, window_seconds=feature_window_seconds
        )
        if any(value > 0 for value in features.values()):
            buckets.append(features)
        bucket_end = bucket_start

    if len(buckets) < MIN_BUCKETS_FOR_BASELINE:
        logger.info(
            "Insufficient history to compute baseline for %s:%s (%d active buckets found).",
            entity_type, entity_value, len(buckets),
        )
        return None

    baseline_mean: dict[str, float] = {}
    baseline_stddev: dict[str, float] = {}
    for feature_name in FEATURE_NAMES:
        values = [bucket[feature_name] for bucket in buckets]
        baseline_mean[feature_name] = mean(values)
        baseline_stddev[feature_name] = pstdev(values) if len(values) > 1 else 0.0

    return BaselineResult(
        entity_type=entity_type,
        entity_value=entity_value,
        baseline_mean=baseline_mean,
        baseline_stddev=baseline_stddev,
        bucket_count=len(buckets),
    )


def compute_z_scores(observed: dict[str, float], baseline: BaselineResult) -> dict[str, float]:
    """Compute a z-score per feature; treats zero-variance features conservatively."""
    z_scores: dict[str, float] = {}
    for feature_name in FEATURE_NAMES:
        observed_value = observed.get(feature_name, 0.0)
        baseline_mean_value = baseline.baseline_mean.get(feature_name, 0.0)
        baseline_std_value = baseline.baseline_stddev.get(feature_name, 0.0)
        if baseline_std_value == 0:
            # No historical variance recorded: any deviation from the
            # (constant) baseline mean is treated as a full-magnitude
            # signal rather than causing a division by zero.
            z_scores[feature_name] = 0.0 if observed_value == baseline_mean_value else 4.0
        else:
            z_scores[feature_name] = (observed_value - baseline_mean_value) / baseline_std_value
    return z_scores


def is_statistically_anomalous(
    z_scores: dict[str, float], threshold: float = 3.0
) -> tuple[bool, Optional[str]]:
    """Return (is_anomalous, feature_name_with_max_absolute_deviation)."""
    if not z_scores:
        return False, None
    worst_feature = max(z_scores, key=lambda name: abs(z_scores[name]))
    return abs(z_scores[worst_feature]) >= threshold, worst_feature