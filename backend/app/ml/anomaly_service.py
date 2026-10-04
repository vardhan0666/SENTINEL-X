"""
ML anomaly detection orchestration service.

For a given entity (source IP, username, or hostname) and observation
time, computes:
  1. A statistical baseline z-score anomaly signal (app.ml.baseline_stats)
  2. An Isolation Forest anomaly score (app.ml.isolation_forest_model, via
     app.ml.model_registry)

Both results are persisted as AnomalyResult rows (labeled with their
respective model_version), whether or not they crossed the anomaly
threshold. A Detection row of type ML_ANOMALY is created only when a
method flags the observation as anomalous.

Per the project's AI-transparency requirement, ML-derived detections are
never presented as certain — confidence values reflect statistical
deviation, not proof of malicious intent, and every ML detection's
`reason` and recommended action say so explicitly.
"""
import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import manager
from app.ml.baseline_stats import compute_baseline, compute_z_scores, is_statistically_anomalous
from app.ml.feature_extraction import extract_features_for_entity, feature_dict_to_vector
from app.ml.model_registry import registry
from app.models.anomaly import AnomalyResult
from app.models.detection import Detection, DetectionType
from app.schemas.detection import DetectionRead

logger = logging.getLogger("sentinelx.ml.anomaly_service")

BASELINE_MODEL_VERSION = "statistical_baseline_v1"
Z_SCORE_THRESHOLD = 3.0

_ENTITY_FIELD_MAP = {"SOURCE_IP": "source_ip", "USERNAME": "username", "HOSTNAME": "hostname"}


async def evaluate_entity_anomaly(
    db: AsyncSession,
    entity_type: str,
    entity_value: str,
    window_end: datetime,
    window_seconds: int = 300,
) -> list[AnomalyResult]:
    """
    Run both anomaly detection methods for a single entity/window and
    persist their results. Returns the AnomalyResult rows created (one per
    method that produced a result).
    """
    entity_type = entity_type.upper()
    results: list[AnomalyResult] = []

    observed_features = await extract_features_for_entity(
        db, entity_type, entity_value, window_end=window_end, window_seconds=window_seconds
    )

    # --- Method 1: Statistical baseline ---
    baseline = await compute_baseline(db, entity_type, entity_value, window_end=window_end)
    if baseline is not None:
        z_scores = compute_z_scores(observed_features, baseline)
        is_anomalous, worst_feature = is_statistically_anomalous(z_scores, threshold=Z_SCORE_THRESHOLD)

        stat_result = AnomalyResult(
            entity_type=entity_type,
            entity_value=entity_value,
            feature_snapshot={"observed": observed_features, "z_scores": z_scores},
            anomaly_score=max((abs(v) for v in z_scores.values()), default=0.0),
            is_anomalous=is_anomalous,
            model_version=BASELINE_MODEL_VERSION,
            baseline_mean=baseline.baseline_mean,
        )
        db.add(stat_result)
        await db.commit()
        await db.refresh(stat_result)
        results.append(stat_result)

        if is_anomalous:
            await _create_ml_detection(
                db,
                stat_result,
                reason=(
                    f"{entity_type.replace('_', ' ').title()} '{entity_value}' deviated from its "
                    f"{baseline.bucket_count}-window learned baseline: '{worst_feature}' observed at "
                    f"{observed_features.get(worst_feature, 0):.0f} vs. baseline mean "
                    f"{baseline.baseline_mean.get(worst_feature, 0):.1f} "
                    f"(z-score {z_scores.get(worst_feature, 0):.2f})."
                ),
                confidence=min(0.95, 0.5 + abs(z_scores.get(worst_feature, 0)) * 0.05),
            )
    else:
        logger.info(
            "Skipping statistical baseline check for %s:%s — insufficient history.",
            entity_type, entity_value,
        )

    # --- Method 2: Isolation Forest ---
    model = registry.get_model()
    if model is not None and model.is_fitted:
        vector = feature_dict_to_vector(observed_features)
        score_result = model.score(vector)

        iso_result = AnomalyResult(
            entity_type=entity_type,
            entity_value=entity_value,
            feature_snapshot={"observed": observed_features, "raw_score": score_result.raw_score},
            anomaly_score=score_result.anomaly_score,
            is_anomalous=score_result.is_anomalous,
            model_version=f"isolation_forest_{registry.model_version}",
            baseline_mean=None,
        )
        db.add(iso_result)
        await db.commit()
        await db.refresh(iso_result)
        results.append(iso_result)

        if score_result.is_anomalous:
            await _create_ml_detection(
                db,
                iso_result,
                reason=(
                    f"Isolation Forest flagged {entity_type.replace('_', ' ').title()} "
                    f"'{entity_value}' as anomalous (anomaly score "
                    f"{score_result.anomaly_score:.2f} on a 0-1 scale, where higher is "
                    f"more anomalous). This is a statistical signal, not a confirmed threat."
                ),
                confidence=round(0.4 + score_result.anomaly_score * 0.5, 2),
            )
    else:
        logger.info("No trained Isolation Forest model available — skipping ML scoring.")

    return results


async def _create_ml_detection(
    db: AsyncSession, anomaly_result: AnomalyResult, reason: str, confidence: float
) -> Detection:
    field_name = _ENTITY_FIELD_MAP.get(anomaly_result.entity_type, "source_ip")

    detection = Detection(
        rule_key=None,
        detection_type=DetectionType.ML_ANOMALY,
        title="ML Behavioral Anomaly Detected",
        category="anomaly",
        severity="medium",
        confidence=confidence,
        reason=reason,
        evidence={
            "anomaly_result_id": anomaly_result.id,
            "model_version": anomaly_result.model_version,
            "feature_snapshot": anomaly_result.feature_snapshot,
            "recommended_action": (
                "Review recent activity for this entity. This is a statistical "
                "anomaly signal, not a confirmed threat — correlate with rule-based "
                "detections before taking action."
            ),
        },
        **{field_name: anomaly_result.entity_value},
    )
    db.add(detection)
    await db.commit()
    await db.refresh(detection)

    anomaly_result.detection_id = detection.id
    await db.commit()

    logger.info(
        "ML anomaly detection created for %s '%s' (model %s).",
        anomaly_result.entity_type, anomaly_result.entity_value, anomaly_result.model_version,
    )

    await manager.broadcast(
        {
            "type": "detection.created",
            "data": DetectionRead.model_validate(detection).model_dump(mode="json"),
        }
    )

    return detection