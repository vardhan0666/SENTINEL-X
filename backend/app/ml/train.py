"""
Isolation Forest training pipeline.

Two data sources are supported:

1. Database-driven training (preferred): feature vectors are extracted
   directly from ingested Events across many entities and time windows,
   producing a baseline grounded in this platform's actual observed
   traffic. Used once at least MIN_REAL_SAMPLES windows of activity exist.

2. Synthetic bootstrap data (fallback): statistically sampled "normal"
   feature vectors, used so SENTINEL-X has a working anomaly model
   immediately after first startup, before any real or simulated
   telemetry has been ingested. This is clearly logged and reported so it
   is never mistaken for a model trained on real observed behavior.

Run inside the backend container:

    docker compose exec backend python -m app.ml.train

This is also exposed to administrators via POST /api/v1/ml/retrain
(app/api/ml.py), which invokes the same training routine in-process.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.ml.feature_extraction import FEATURE_NAMES, extract_features_for_entity
from app.ml.isolation_forest_model import IsolationForestModel
from app.ml.model_registry import registry
from app.models.event import Event

logger = logging.getLogger("sentinelx.ml.train")

MIN_REAL_SAMPLES = 50
SYNTHETIC_SAMPLE_COUNT = 500

# Approximate Poisson means for "normal" behavior per feature, over a
# 5-minute window. These are deliberately conservative, generic baselines
# used only to bootstrap the model before real telemetry is available —
# they are not a substitute for training on this platform's own data.
_SYNTHETIC_FEATURE_MEANS = {
    "auth_attempts": 2.0,
    "distinct_destinations": 4.0,
    "distinct_ports": 3.0,
    "dns_queries": 8.0,
    "process_starts": 2.0,
}


def generate_synthetic_training_data(
    n_samples: int = SYNTHETIC_SAMPLE_COUNT, seed: int = 42
) -> list[list[float]]:
    """Generate synthetic 'normal' feature vectors for bootstrap training."""
    rng = np.random.default_rng(seed)
    return [
        [float(rng.poisson(_SYNTHETIC_FEATURE_MEANS[name])) for name in FEATURE_NAMES]
        for _ in range(n_samples)
    ]


async def extract_training_data_from_db(
    db: AsyncSession, lookback_hours: int = 24 * 7, window_seconds: int = 300
) -> list[list[float]]:
    """
    Extract feature vectors from real ingested events: one vector per
    (source IP, time-window) combination observed in the lookback period
    that had any activity.
    """
    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(hours=lookback_hours)

    result = await db.execute(
        select(Event.source_ip)
        .where(Event.timestamp >= window_start, Event.source_ip.isnot(None))
        .distinct()
    )
    entities = [row[0] for row in result.all()]

    samples: list[list[float]] = []
    current = window_start
    while current < window_end:
        for entity_value in entities:
            features = await extract_features_for_entity(
                db, "SOURCE_IP", entity_value, window_end=current, window_seconds=window_seconds
            )
            vector = [features[name] for name in FEATURE_NAMES]
            if any(v > 0 for v in vector):
                samples.append(vector)
        current += timedelta(seconds=window_seconds)

    return samples


async def train_and_save_model() -> str:
    """
    Train (preferring real ingested data if sufficient, else synthetic
    bootstrap data) and persist the Isolation Forest model. Returns the
    model version string that was saved.
    """
    async with AsyncSessionLocal() as db:
        training_data = await extract_training_data_from_db(db)

    data_source = "database"
    if len(training_data) < MIN_REAL_SAMPLES:
        logger.info(
            "Only %d real training samples available (minimum %d required) — "
            "falling back to synthetic bootstrap data.",
            len(training_data), MIN_REAL_SAMPLES,
        )
        training_data = generate_synthetic_training_data()
        data_source = "synthetic_bootstrap"

    model = IsolationForestModel()
    model.fit(training_data)

    registry.save(model)

    logger.info(
        "Model trained on %d samples (source: %s) and saved as version '%s'.",
        len(training_data), data_source, registry.model_version,
    )
    return registry.model_version


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    asyncio.run(train_and_save_model())