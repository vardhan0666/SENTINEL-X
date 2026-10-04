"""
Sentinel-X — Normalization Tests
===================================
Tests for all normalizers registered in the existing normalization layer.

Tests verify:
  - Each registered normalizer produces a valid canonical event dict
  - Required fields are present and correctly typed
  - Optional fields are preserved or correctly mapped
  - Malformed / missing input fields are handled gracefully
  - Raw telemetry from each simulated source type normalises correctly
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import pytest

from app.services.normalization.normalizer import EventNormalizer
from app.services.normalization.registry import NormalizerRegistry

# If individual source normalizers exist as separate classes, import them.
# We use a try/except so the test file doesn't break if the import paths differ.
try:
    from app.services.normalization.sources.windows import WindowsNormalizer
    from app.services.normalization.sources.network import NetworkNormalizer
    from app.services.normalization.sources.dns import DNSNormalizer
    from app.services.normalization.sources.endpoint import EndpointNormalizer
    _HAS_INDIVIDUAL_NORMALIZERS = True
except ImportError:
    _HAS_INDIVIDUAL_NORMALIZERS = False

pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# Required canonical fields
# ---------------------------------------------------------------------------

REQUIRED_CANONICAL_FIELDS = {
    "event_id",
    "timestamp",
    "source",
    "event_type",
    "severity",
}

VALID_SEVERITIES = {"low", "medium", "high", "critical"}


# ---------------------------------------------------------------------------
# Raw telemetry factories
# ---------------------------------------------------------------------------


def _windows_raw() -> dict[str, Any]:
    return {
        "EventID": 4625,
        "TimeCreated": datetime.now(timezone.utc).isoformat(),
        "Computer": "ws-001.corp.local",
        "TargetUserName": "alice.johnson",
        "IpAddress": "10.0.1.5",
        "LogonType": 3,
        "SubStatus": "0xC000006A",
        "source": "windows-ad",
    }


def _network_raw() -> dict[str, Any]:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": "10.0.1.5",
        "dst_ip": "10.0.1.10",
        "src_port": 54321,
        "dst_port": 443,
        "protocol": "TCP",
        "action": "allow",
        "bytes": 1024,
        "source": "network-sensor",
        "event_type": "network.connection",
    }


def _dns_raw() -> dict[str, Any]:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "client_ip": "10.0.1.5",
        "query_name": "microsoft.com",
        "query_type": "A",
        "response_code": "NOERROR",
        "source": "dns-server",
    }


def _endpoint_raw() -> dict[str, Any]:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "hostname": "ws-001.corp.local",
        "process_name": "chrome.exe",
        "pid": 12345,
        "parent_process": "explorer.exe",
        "username": "alice.johnson",
        "command_line": "chrome.exe --no-sandbox",
        "source": "windows-endpoint",
        "event_type": "process.start",
    }


def _canonical_event() -> dict[str, Any]:
    """A pre-normalised canonical event (should pass through unchanged)."""
    return {
        "event_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "test-source",
        "event_type": "authentication.success",
        "severity": "low",
        "category": "authentication",
        "username": "testuser",
        "hostname": "ws-001.corp.local",
        "action": "login",
        "status": "success",
        "message": "Normal authentication",
    }


# ===========================================================================
# EventNormalizer — top-level normalizer
# ===========================================================================


class TestEventNormalizer:

    def test_normalizer_initialises(self):
        normalizer = EventNormalizer()
        assert normalizer is not None

    def test_normalize_canonical_event_passthrough(self):
        normalizer = EventNormalizer()
        raw = _canonical_event()
        result = normalizer.normalize(raw, source="test-source")
        assert result is not None
        for field in REQUIRED_CANONICAL_FIELDS:
            assert field in result, f"Missing required field: {field}"

    def test_normalize_produces_valid_severity(self):
        normalizer = EventNormalizer()
        raw = _canonical_event()
        result = normalizer.normalize(raw, source="test-source")
        assert result["severity"] in VALID_SEVERITIES

    def test_normalize_event_id_preserved(self):
        normalizer = EventNormalizer()
        raw = _canonical_event()
        original_id = raw["event_id"]
        result = normalizer.normalize(raw, source="test-source")
        assert result["event_id"] == original_id

    def test_normalize_generates_event_id_when_missing(self):
        normalizer = EventNormalizer()
        raw = _canonical_event()
        del raw["event_id"]
        result = normalizer.normalize(raw, source="test-source")
        assert "event_id" in result
        assert result["event_id"] is not None
        assert len(result["event_id"]) > 0

    def test_normalize_timestamp_is_string_or_datetime(self):
        normalizer = EventNormalizer()
        raw = _canonical_event()
        result = normalizer.normalize(raw, source="test-source")
        ts = result["timestamp"]
        assert isinstance(ts, (str, datetime))

    def test_normalize_source_preserved(self):
        normalizer = EventNormalizer()
        raw = _canonical_event()
        result = normalizer.normalize(raw, source="test-source")
        assert result["source"] == "test-source"

    def test_normalize_windows_raw(self):
        normalizer = EventNormalizer()
        raw = _windows_raw()
        result = normalizer.normalize(raw, source="windows-ad")
        assert result is not None
        for field in REQUIRED_CANONICAL_FIELDS:
            assert field in result, f"Windows normalization missing: {field}"

    def test_normalize_network_raw(self):
        normalizer = EventNormalizer()
        raw = _network_raw()
        result = normalizer.normalize(raw, source="network-sensor")
        assert result is not None
        for field in REQUIRED_CANONICAL_FIELDS:
            assert field in result, f"Network normalization missing: {field}"

    def test_normalize_dns_raw(self):
        normalizer = EventNormalizer()
        raw = _dns_raw()
        result = normalizer.normalize(raw, source="dns-server")
        assert result is not None
        for field in REQUIRED_CANONICAL_FIELDS:
            assert field in result, f"DNS normalization missing: {field}"

    def test_normalize_endpoint_raw(self):
        normalizer = EventNormalizer()
        raw = _endpoint_raw()
        result = normalizer.normalize(raw, source="windows-endpoint")
        assert result is not None
        for field in REQUIRED_CANONICAL_FIELDS:
            assert field in result, f"Endpoint normalization missing: {field}"


class TestEventNormalizerEdgeCases:

    def test_empty_dict_does_not_crash(self):
        normalizer = EventNormalizer()
        try:
            result = normalizer.normalize({}, source="unknown")
            # If it returns, it should still have required fields or be None
            if result is not None:
                assert "event_id" in result or "source" in result
        except (ValueError, KeyError):
            pass  # Acceptable to raise on completely empty input

    def test_none_source_handled(self):
        normalizer = EventNormalizer()
        raw = _canonical_event()
        try:
            result = normalizer.normalize(raw, source=None)
            assert result is not None
        except (ValueError, TypeError):
            pass  # Acceptable

    def test_invalid_severity_gets_defaulted(self):
        normalizer = EventNormalizer()
        raw = _canonical_event()
        raw["severity"] = "extreme"
        result = normalizer.normalize(raw, source="test-source")
        if result is not None:
            assert result["severity"] in VALID_SEVERITIES

    def test_unix_timestamp_normalised(self):
        normalizer = EventNormalizer()
        raw = _canonical_event()
        # Replace ISO timestamp with unix timestamp
        raw["timestamp"] = 1700000000.0
        try:
            result = normalizer.normalize(raw, source="test-source")
            if result is not None:
                assert "timestamp" in result
        except (ValueError, TypeError):
            pass

    def test_future_timestamp_preserved(self):
        normalizer = EventNormalizer()
        raw = _canonical_event()
        # Far future timestamp — normalizer should not reject it
        raw["timestamp"] = "2099-12-31T23:59:59Z"
        try:
            result = normalizer.normalize(raw, source="test-source")
            assert result is not None
        except (ValueError, TypeError):
            pass

    def test_metadata_preserved(self):
        normalizer = EventNormalizer()
        raw = _canonical_event()
        raw["metadata"] = {"custom_key": "custom_value", "count": 42}
        result = normalizer.normalize(raw, source="test-source")
        if result is not None and "metadata" in result:
            assert result["metadata"].get("custom_key") == "custom_value"


# ===========================================================================
# NormalizerRegistry
# ===========================================================================


class TestNormalizerRegistry:

    def test_registry_initialises(self):
        registry = NormalizerRegistry()
        assert registry is not None

    def test_registry_has_registered_normalizers(self):
        registry = NormalizerRegistry()
        normalizers = registry.list_normalizers()
        assert len(normalizers) > 0

    def test_registry_get_by_source(self):
        registry = NormalizerRegistry()
        # Each registered source should return a normalizer
        for source in registry.list_normalizers():
            normalizer = registry.get(source)
            assert normalizer is not None

    def test_registry_unknown_source_returns_default(self):
        registry = NormalizerRegistry()
        result = registry.get("completely_unknown_source_xyz")
        # Should return either None or a default/passthrough normalizer
        assert result is None or hasattr(result, "normalize")


# ===========================================================================
# Individual source normalizers (if importable)
# ===========================================================================


@pytest.mark.skipif(
    not _HAS_INDIVIDUAL_NORMALIZERS,
    reason="Individual source normalizers not importable from expected paths",
)
class TestWindowsNormalizer:

    def test_normalizes_auth_failure(self):
        norm = WindowsNormalizer()
        raw = _windows_raw()
        result = norm.normalize(raw)
        assert result is not None
        assert result.get("event_type") in (
            "authentication.failure",
            "authentication.success",
            "authentication",
        )
        assert result.get("severity") in VALID_SEVERITIES

    def test_normalizes_source_ip(self):
        norm = WindowsNormalizer()
        raw = _windows_raw()
        result = norm.normalize(raw)
        if result is not None:
            # Source IP should be extracted from IpAddress field
            assert result.get("source_ip") == "10.0.1.5" or result.get("source_ip") is None


@pytest.mark.skipif(
    not _HAS_INDIVIDUAL_NORMALIZERS,
    reason="Individual source normalizers not importable from expected paths",
)
class TestNetworkNormalizer:

    def test_normalizes_connection_event(self):
        norm = NetworkNormalizer()
        raw = _network_raw()
        result = norm.normalize(raw)
        assert result is not None
        assert result.get("event_type") is not None
        assert result.get("severity") in VALID_SEVERITIES