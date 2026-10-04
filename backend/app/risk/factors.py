"""
Pure, unit-testable risk factor calculations used by app.risk.scoring.

Each factor function returns a value in the range [0.0, 1.0], representing
how much that dimension contributes to overall risk. app.risk.scoring
combines these factors using a documented, fixed set of weights to produce
the final 0-100 risk score — see that module's docstring for the full
formula and rationale.
"""
import math
from typing import Iterable

from app.models.asset import AssetCriticality

_SEVERITY_WEIGHTS = {"low": 0.25, "medium": 0.5, "high": 0.75, "critical": 1.0}
_ASSET_CRITICALITY_WEIGHTS = {
    AssetCriticality.LOW: 0.25,
    AssetCriticality.MEDIUM: 0.5,
    AssetCriticality.HIGH: 0.75,
    AssetCriticality.CRITICAL: 1.0,
}

FREQUENCY_SATURATION_COUNT = 20
HISTORICAL_SATURATION_COUNT = 10
CORRELATION_SATURATION_CATEGORIES = 3


def severity_factor(severities: Iterable[str]) -> float:
    """Highest severity among the given detections, mapped to [0, 1]."""
    values = [_SEVERITY_WEIGHTS.get(s.lower(), 0.5) for s in severities]
    return max(values) if values else 0.0


def frequency_factor(detection_count: int) -> float:
    """
    Diminishing-returns scaling of detection count: a single detection is
    a mild signal, dozens of related detections approach the maximum.
    """
    if detection_count <= 0:
        return 0.0
    return min(1.0, math.log2(detection_count + 1) / math.log2(FREQUENCY_SATURATION_COUNT + 1))


def confidence_factor(confidences: Iterable[float]) -> float:
    """Average confidence across the given detections."""
    values = list(confidences)
    return sum(values) / len(values) if values else 0.0


def detection_type_factor(detection_types: Iterable[str]) -> float:
    """
    Corroboration bonus: rule-based and ML-based detections agreeing on
    the same activity is a stronger signal than either alone.
    """
    types = set(detection_types)
    if "RULE" in types and "ML_ANOMALY" in types:
        return 1.0
    if "RULE" in types:
        return 0.7
    if "ML_ANOMALY" in types:
        return 0.5
    return 0.0


def correlation_strength_factor(categories: Iterable[str]) -> float:
    """
    Multi-stage attack chains (detections spanning several categories,
    e.g. authentication + endpoint + network) are riskier than repeated
    detections within a single category.
    """
    distinct_categories = len(set(categories))
    return min(1.0, distinct_categories / CORRELATION_SATURATION_CATEGORIES)


def asset_importance_factor(criticality: AssetCriticality) -> float:
    return _ASSET_CRITICALITY_WEIGHTS.get(criticality, 0.5)


def historical_repetition_factor(prior_related_detection_count: int) -> float:
    """
    Repeat-offender scaling: prior detections involving the same source IP
    or username in the preceding lookback period increase risk.
    """
    if prior_related_detection_count <= 0:
        return 0.0
    return min(
        1.0,
        math.log2(prior_related_detection_count + 1) / math.log2(HISTORICAL_SATURATION_COUNT + 1),
    )