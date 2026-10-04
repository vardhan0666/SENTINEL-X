"""
Isolation Forest wrapper for behavioral anomaly detection.

Trained offline by app.ml.train on windowed feature vectors (see
app.ml.feature_extraction). At inference time, app.ml.anomaly_service
scores a single entity's current feature window against this model.

IMPORTANT: An Isolation Forest anomaly score is a statistical signal, not
a certainty of malicious activity. See docs/ML.md (added in a later batch)
for a full discussion of this model's limitations.
"""
from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import IsolationForest

from app.ml.feature_extraction import FEATURE_NAMES

DEFAULT_RANDOM_STATE = 42
DEFAULT_CONTAMINATION = 0.05
DEFAULT_N_ESTIMATORS = 200


@dataclass
class IsolationForestScoreResult:
    raw_score: float      # sklearn decision_function output (higher = more normal)
    anomaly_score: float  # normalized 0..1, higher = more anomalous
    is_anomalous: bool


class IsolationForestModel:
    """Thin, explicit wrapper around sklearn's IsolationForest, kept
    joblib-picklable as a plain Python object for persistence."""

    def __init__(
        self,
        n_estimators: int = DEFAULT_N_ESTIMATORS,
        contamination: float = DEFAULT_CONTAMINATION,
        random_state: int = DEFAULT_RANDOM_STATE,
    ):
        self.feature_names = list(FEATURE_NAMES)
        self._model = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            random_state=random_state,
        )
        self._is_fitted = False

    def fit(self, feature_matrix: list[list[float]]) -> None:
        if len(feature_matrix) < 10:
            raise ValueError(
                "At least 10 training samples are required to fit a "
                "meaningful Isolation Forest model."
            )
        X = np.array(feature_matrix, dtype=float)
        self._model.fit(X)
        self._is_fitted = True

    def score(self, feature_vector: list[float]) -> IsolationForestScoreResult:
        if not self._is_fitted:
            raise RuntimeError("Model has not been fitted or loaded yet.")

        X = np.array([feature_vector], dtype=float)
        raw_score = float(self._model.decision_function(X)[0])
        prediction = int(self._model.predict(X)[0])  # -1 anomalous, 1 normal

        # decision_function typically ranges roughly [-0.5, 0.5]; map to a
        # 0..1 "anomaly score" for presentation purposes only. The actual
        # anomaly verdict comes from predict(), not from this transform.
        anomaly_score = max(0.0, min(1.0, 0.5 - raw_score))

        return IsolationForestScoreResult(
            raw_score=raw_score,
            anomaly_score=anomaly_score,
            is_anomalous=(prediction == -1),
        )

    @property
    def is_fitted(self) -> bool:
        return self._is_fitted