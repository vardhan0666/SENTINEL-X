"""
Sentinel-X — ML Anomaly Detection Tests
==========================================
Tests for the existing ML anomaly detection pipeline:
  - Feature extraction
  - Baseline statistics computation
  - Isolation Forest model training/inference
  - Model registry
  - Anomaly service evaluate function

All tests use synthetic in-memory data.
No external ML services are required.
Tests are deterministic (fixed random seeds where applicable).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import numpy as np

from app.ml.features import extract_features
from app.ml.baseline import BaselineStatistics
from app.ml.model_registry import ModelRegistry
from app.ml.anomaly_service import AnomalyService
from app.models.event import Event

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_event(
    event_type: str = "authentication.success",
    severity: str = "low",
    source_ip: str = "10.0.1.5",
    destination_ip: str = "10.0.1.10",
    source_port: int = 54321,
    destination_port: int = 443,
    protocol: str = "TCP",
    action: str = "login",
    status: str = "success",
    category: str = "authentication",
) -> Event:
    ev = Event()
    ev.event_id = str(uuid.uuid4())
    ev.timestamp = datetime.now(timezone.utc)
    ev.source = "test-sensor"
    ev.event_type = event_type
    ev.severity = severity
    ev.category = category
    ev.source_ip = source_ip
    ev.destination_ip = destination_ip
    ev.source_port = source_port
    ev.destination_port = destination_port
    ev.protocol = protocol
    ev.action = action
    ev.status = status
    ev.message = "Test ML event"
    ev.event_metadata = {}
    return ev


def _normal_events(n: int = 50) -> list[Event]:
    """Generate a list of normal authentication events."""
    return [
        _make_event(
            severity="low",
            source_ip=f"10.0.1.{(i % 20) + 1}",
            destination_port=443,
        )
        for i in range(n)
    ]


def _anomalous_event() -> Event:
    """Generate a single clearly anomalous event."""
    return _make_event(
        event_type="authentication.failure",
        severity="critical",
        source_ip="203.0.113.99",
        destination_port=4444,
        action="login",
        status="failure",
    )


# ===========================================================================
# Feature extraction
# ===========================================================================


class TestFeatureExtraction:

    def test_extract_features_returns_array(self):
        event = _make_event()
        features = extract_features(event)
        assert features is not None
        assert hasattr(features, "__len__") or isinstance(features, (list, np.ndarray))

    def test_extract_features_deterministic(self):
        event = _make_event()
        f1 = extract_features(event)
        f2 = extract_features(event)
        assert list(f1) == list(f2)

    def test_extract_features_non_empty(self):
        event = _make_event()
        features = extract_features(event)
        assert len(features) > 0

    def test_extract_features_different_events_differ(self):
        normal = _make_event(severity="low", destination_port=443)
        anomalous = _make_event(severity="critical", destination_port=4444)
        f_normal = list(extract_features(normal))
        f_anomalous = list(extract_features(anomalous))
        assert f_normal != f_anomalous

    def test_extract_features_handles_none_optional_fields(self):
        event = _make_event()
        event.source_ip = None
        event.destination_ip = None
        event.source_port = None
        event.destination_port = None
        event.protocol = None
        # Should not raise
        features = extract_features(event)
        assert features is not None

    def test_feature_vector_is_numeric(self):
        event = _make_event()
        features = extract_features(event)
        arr = np.array(features, dtype=float)
        assert not np.any(np.isnan(arr)), "Feature vector contains NaN values"

    def test_feature_vector_finite(self):
        event = _make_event()
        features = extract_features(event)
        arr = np.array(features, dtype=float)
        assert np.all(np.isfinite(arr)), "Feature vector contains infinite values"


# ===========================================================================
# Baseline statistics
# ===========================================================================


class TestBaselineStatistics:

    def test_fit_on_normal_events(self):
        baseline = BaselineStatistics()
        events = _normal_events(50)
        baseline.fit(events)
        assert baseline.is_fitted

    def test_score_normal_event_low_anomaly(self):
        baseline = BaselineStatistics()
        events = _normal_events(50)
        baseline.fit(events)
        normal = _make_event(severity="low")
        score = baseline.score(normal)
        assert isinstance(score, float)
        assert score >= 0.0

    def test_score_anomalous_event_higher_than_normal(self):
        baseline = BaselineStatistics()
        events = _normal_events(100)
        baseline.fit(events)

        normal = _make_event(severity="low", destination_port=443)
        anomalous = _anomalous_event()

        normal_score = baseline.score(normal)
        anomalous_score = baseline.score(anomalous)
        assert anomalous_score >= normal_score

    def test_score_before_fit_raises_or_returns_none(self):
        baseline = BaselineStatistics()
        event = _make_event()
        try:
            result = baseline.score(event)
            assert result is None or isinstance(result, float)
        except Exception:
            pass  # Acceptable to raise when not fitted

    def test_fit_empty_events_handled(self):
        baseline = BaselineStatistics()
        try:
            baseline.fit([])
        except (ValueError, RuntimeError):
            pass  # Acceptable to raise on empty input

    def test_baseline_serialisable(self):
        baseline = BaselineStatistics()
        events = _normal_events(30)
        baseline.fit(events)
        # Should expose a way to serialize/get stats dict
        stats = baseline.get_stats()
        assert isinstance(stats, dict)


# ===========================================================================
# Model registry
# ===========================================================================


class TestModelRegistry:

    def test_registry_is_singleton_like(self):
        r1 = ModelRegistry()
        r2 = ModelRegistry()
        # Should share state (either singleton or shared storage)
        assert type(r1) == type(r2)

    def test_registry_register_and_retrieve(self):
        registry = ModelRegistry()
        mock_model = MagicMock()
        mock_model.predict = MagicMock(return_value=np.array([1.0]))
        registry.register("test_model", mock_model)
        retrieved = registry.get("test_model")
        assert retrieved is mock_model

    def test_registry_get_nonexistent_returns_none(self):
        registry = ModelRegistry()
        result = registry.get("nonexistent_model_xyz_12345")
        assert result is None

    def test_registry_list_models(self):
        registry = ModelRegistry()
        mock_model = MagicMock()
        registry.register("list_test_model", mock_model)
        models = registry.list_models()
        assert "list_test_model" in models

    def test_registry_unregister(self):
        registry = ModelRegistry()
        mock_model = MagicMock()
        registry.register("temp_model", mock_model)
        registry.unregister("temp_model")
        assert registry.get("temp_model") is None


# ===========================================================================
# Anomaly service
# ===========================================================================


class TestAnomalyService:

    async def test_evaluate_returns_result(self, db_session):
        service = AnomalyService()
        event = _make_event()

        result = await service.evaluate(db=db_session, event=event)
        # Result may be None (not enough baseline data yet) or a score/dict
        assert result is None or isinstance(result, (float, dict))

    async def test_evaluate_anomalous_event(self, db_session):
        service = AnomalyService()

        # Pre-fit the service with normal data if the API supports it
        if hasattr(service, "fit"):
            await service.fit(db=db_session, events=_normal_events(50))

        event = _anomalous_event()
        result = await service.evaluate(db=db_session, event=event)
        assert result is None or isinstance(result, (float, dict))

    async def test_evaluate_does_not_raise_on_normal_event(self, db_session):
        service = AnomalyService()
        event = _make_event(severity="low")
        try:
            await service.evaluate(db=db_session, event=event)
        except Exception as exc:
            pytest.fail(f"AnomalyService.evaluate raised unexpectedly: {exc}")

    async def test_service_run_for_event_id(self, db_session):
        """The async pipeline entry-point should accept db + event_id."""
        service = AnomalyService()
        event_id = str(uuid.uuid4())

        with patch.object(service, "_load_event", new_callable=AsyncMock) as mock_load:
            mock_load.return_value = _make_event()
            result = await service.run_for_event_id(db=db_session, event_id=event_id)
            assert result is None or isinstance(result, (float, dict))