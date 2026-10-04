"""
Model registry: loads/saves the Isolation Forest model artifact and
exposes a single shared instance to the rest of the running backend
process.

Model artifacts are stored under settings.ML_MODEL_DIR, which is mounted
as the persistent `ml_artifacts` Docker volume (see docker-compose.yml),
so a trained model survives container restarts without needing to
retrain on every startup.

NOTE: This registry is an in-process singleton. Per the project's
single-worker deployment design (see docs/ARCHITECTURE.md), this is
sufficient; if the backend is ever scaled to multiple Uvicorn workers,
each worker would load its own copy of the model file independently
(safe, since the artifact is read-only at inference time) — no shared
in-memory state is required across workers for this to work correctly.
"""
import logging
from pathlib import Path
from typing import Optional

import joblib

from app.core.config import settings
from app.ml.isolation_forest_model import IsolationForestModel

logger = logging.getLogger("sentinelx.ml.registry")

MODEL_FILENAME_PREFIX = "isolation_forest"
CURRENT_MODEL_VERSION = "v1"


class ModelRegistry:
    def __init__(self, model_dir: str):
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self._model: Optional[IsolationForestModel] = None
        self._model_version: Optional[str] = None

    def _artifact_path(self, version: str) -> Path:
        return self.model_dir / f"{MODEL_FILENAME_PREFIX}_{version}.joblib"

    def save(self, model: IsolationForestModel, version: str = CURRENT_MODEL_VERSION) -> Path:
        path = self._artifact_path(version)
        joblib.dump(model, path)
        logger.info("Saved Isolation Forest model artifact to %s", path)
        self._model = model
        self._model_version = version
        return path

    def load(self, version: str = CURRENT_MODEL_VERSION) -> Optional[IsolationForestModel]:
        path = self._artifact_path(version)
        if not path.exists():
            logger.warning(
                "No Isolation Forest model artifact found at %s. "
                "Run `python -m app.ml.train` (or POST /api/v1/ml/retrain) to train one.",
                path,
            )
            return None
        model: IsolationForestModel = joblib.load(path)
        self._model = model
        self._model_version = version
        logger.info("Loaded Isolation Forest model artifact from %s", path)
        return model

    def get_model(self) -> Optional[IsolationForestModel]:
        if self._model is None:
            self.load()
        return self._model

    @property
    def model_version(self) -> str:
        return self._model_version or "unloaded"


registry = ModelRegistry(settings.ML_MODEL_DIR)