"""
Sentinel-X — Schema Validation Tests
=======================================
Tests for EventIngest, EventBatchIngest, and related Pydantic schemas.

Tests cover:
  - Valid minimal event construction
  - All valid severity values
  - Invalid severity values
  - Required field enforcement (event_id, timestamp, source, event_type, severity)
  - Field constraint validation (empty strings, port ranges, message length)
  - Batch size constraints (min 1, max 1000)
  - Optional fields accepted
  - Metadata field accepted
  - Timestamp formats (ISO 8601)
  - Port number bounds
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.event import EventIngest, EventBatchIngest

# ---------------------------------------------------------------------------
# Valid severity values from the existing contract
# ---------------------------------------------------------------------------
VALID_SEVERITIES = ["low", "medium", "high", "critical"]
INVALID_SEVERITIES = ["", "extreme", "info", "warning", "none", "CRITICAL", "High", "0"]


# ---------------------------------------------------------------------------
# Minimal valid payload factory
# ---------------------------------------------------------------------------


def _valid_payload(**overrides) -> dict:
    base = {
        "event_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "test-source",
        "event_type": "authentication.success",
        "severity": "low",
    }
    base.update(overrides)
    return base


# ===========================================================================
# EventIngest — required fields
# ===========================================================================


class TestEventIngestRequiredFields:

    def test_valid_minimal_event(self):
        payload = _valid_payload()
        event = EventIngest(**payload)
        assert event.event_id == payload["event_id"]
        assert event.source == payload["source"]
        assert event.event_type == payload["event_type"]
        assert event.severity == payload["severity"]

    def test_missing_event_id_raises(self):
        payload = _valid_payload()
        del payload["event_id"]
        with pytest.raises(ValidationError) as exc_info:
            EventIngest(**payload)
        errors = exc_info.value.errors()
        assert any(e["loc"][0] == "event_id" for e in errors)

    def test_missing_timestamp_raises(self):
        payload = _valid_payload()
        del payload["timestamp"]
        with pytest.raises(ValidationError) as exc_info:
            EventIngest(**payload)
        errors = exc_info.value.errors()
        assert any(e["loc"][0] == "timestamp" for e in errors)

    def test_missing_source_raises(self):
        payload = _valid_payload()
        del payload["source"]
        with pytest.raises(ValidationError) as exc_info:
            EventIngest(**payload)
        errors = exc_info.value.errors()
        assert any(e["loc"][0] == "source" for e in errors)

    def test_missing_event_type_raises(self):
        payload = _valid_payload()
        del payload["event_type"]
        with pytest.raises(ValidationError) as exc_info:
            EventIngest(**payload)
        errors = exc_info.value.errors()
        assert any(e["loc"][0] == "event_type" for e in errors)

    def test_missing_severity_raises(self):
        payload = _valid_payload()
        del payload["severity"]
        with pytest.raises(ValidationError) as exc_info:
            EventIngest(**payload)
        errors = exc_info.value.errors()
        assert any(e["loc"][0] == "severity" for e in errors)


# ===========================================================================
# EventIngest — severity validation
# ===========================================================================


class TestEventIngestSeverity:

    @pytest.mark.parametrize("severity", VALID_SEVERITIES)
    def test_valid_severity(self, severity: str):
        payload = _valid_payload(severity=severity)
        event = EventIngest(**payload)
        assert event.severity == severity

    @pytest.mark.parametrize("severity", INVALID_SEVERITIES)
    def test_invalid_severity_raises(self, severity: str):
        payload = _valid_payload(severity=severity)
        with pytest.raises(ValidationError):
            EventIngest(**payload)

    def test_severity_none_raises(self):
        payload = _valid_payload(severity=None)
        with pytest.raises(ValidationError):
            EventIngest(**payload)


# ===========================================================================
# EventIngest — field constraints
# ===========================================================================


class TestEventIngestFieldConstraints:

    def test_empty_source_raises(self):
        payload = _valid_payload(source="")
        with pytest.raises(ValidationError):
            EventIngest(**payload)

    def test_empty_event_type_raises(self):
        payload = _valid_payload(event_type="")
        with pytest.raises(ValidationError):
            EventIngest(**payload)

    def test_empty_event_id_raises(self):
        payload = _valid_payload(event_id="")
        with pytest.raises(ValidationError):
            EventIngest(**payload)

    def test_whitespace_only_source_raises(self):
        payload = _valid_payload(source="   ")
        with pytest.raises(ValidationError):
            EventIngest(**payload)

    def test_valid_source_port(self):
        payload = _valid_payload(source_port=54321)
        event = EventIngest(**payload)
        assert event.source_port == 54321

    def test_valid_destination_port(self):
        payload = _valid_payload(destination_port=443)
        event = EventIngest(**payload)
        assert event.destination_port == 443

    def test_port_zero_raises(self):
        payload = _valid_payload(source_port=0)
        with pytest.raises(ValidationError):
            EventIngest(**payload)

    def test_port_above_max_raises(self):
        payload = _valid_payload(destination_port=65536)
        with pytest.raises(ValidationError):
            EventIngest(**payload)

    def test_negative_port_raises(self):
        payload = _valid_payload(source_port=-1)
        with pytest.raises(ValidationError):
            EventIngest(**payload)

    def test_port_1_valid(self):
        payload = _valid_payload(source_port=1)
        event = EventIngest(**payload)
        assert event.source_port == 1

    def test_port_65535_valid(self):
        payload = _valid_payload(destination_port=65535)
        event = EventIngest(**payload)
        assert event.destination_port == 65535

    def test_message_within_limit(self):
        payload = _valid_payload(message="A" * 1000)
        event = EventIngest(**payload)
        assert len(event.message) == 1000

    def test_message_too_long_raises(self):
        # Message limit is assumed to be 10000 characters based on common
        # SIEM practice; adjust to the actual limit if different.
        payload = _valid_payload(message="X" * 10001)
        with pytest.raises(ValidationError):
            EventIngest(**payload)

    def test_valid_iso_timestamp(self):
        payload = _valid_payload(
            timestamp="2024-01-15T12:30:00Z"
        )
        event = EventIngest(**payload)
        assert event.timestamp is not None

    def test_invalid_timestamp_raises(self):
        payload = _valid_payload(timestamp="not-a-date")
        with pytest.raises(ValidationError):
            EventIngest(**payload)

    def test_none_timestamp_raises(self):
        payload = _valid_payload(timestamp=None)
        with pytest.raises(ValidationError):
            EventIngest(**payload)


# ===========================================================================
# EventIngest — optional fields
# ===========================================================================


class TestEventIngestOptionalFields:

    def test_category_accepted(self):
        payload = _valid_payload(category="authentication")
        event = EventIngest(**payload)
        assert event.category == "authentication"

    def test_source_ip_accepted(self):
        payload = _valid_payload(source_ip="10.0.1.5")
        event = EventIngest(**payload)
        assert event.source_ip == "10.0.1.5"

    def test_destination_ip_accepted(self):
        payload = _valid_payload(destination_ip="10.0.1.10")
        event = EventIngest(**payload)
        assert event.destination_ip == "10.0.1.10"

    def test_protocol_accepted(self):
        payload = _valid_payload(protocol="TCP")
        event = EventIngest(**payload)
        assert event.protocol == "TCP"

    def test_username_accepted(self):
        payload = _valid_payload(username="alice.johnson")
        event = EventIngest(**payload)
        assert event.username == "alice.johnson"

    def test_hostname_accepted(self):
        payload = _valid_payload(hostname="ws-001.corp.local")
        event = EventIngest(**payload)
        assert event.hostname == "ws-001.corp.local"

    def test_process_name_accepted(self):
        payload = _valid_payload(process_name="chrome.exe")
        event = EventIngest(**payload)
        assert event.process_name == "chrome.exe"

    def test_action_accepted(self):
        payload = _valid_payload(action="login")
        event = EventIngest(**payload)
        assert event.action == "login"

    def test_status_accepted(self):
        payload = _valid_payload(status="success")
        event = EventIngest(**payload)
        assert event.status == "success"

    def test_message_accepted(self):
        payload = _valid_payload(message="Test authentication event")
        event = EventIngest(**payload)
        assert event.message == "Test authentication event"

    def test_metadata_dict_accepted(self):
        payload = _valid_payload(metadata={"key": "value", "count": 42})
        event = EventIngest(**payload)
        assert event.metadata["key"] == "value"

    def test_metadata_none_accepted(self):
        payload = _valid_payload(metadata=None)
        event = EventIngest(**payload)
        assert event.metadata is None

    def test_all_optional_fields_together(self):
        payload = _valid_payload(
            category="network",
            source_ip="10.0.1.5",
            destination_ip="10.0.1.10",
            source_port=54321,
            destination_port=443,
            protocol="TCP",
            username="alice.johnson",
            hostname="ws-001.corp.local",
            process_name="chrome.exe",
            action="connect",
            status="allowed",
            message="Outbound connection established",
            metadata={"bytes_sent": 1024, "duration_ms": 500},
        )
        event = EventIngest(**payload)
        assert event.source_ip == "10.0.1.5"
        assert event.destination_port == 443
        assert event.metadata["bytes_sent"] == 1024


# ===========================================================================
# EventBatchIngest — batch constraints
# ===========================================================================


class TestEventBatchIngest:

    def test_valid_single_event_batch(self):
        batch = EventBatchIngest(events=[_valid_payload()])
        assert len(batch.events) == 1

    def test_valid_multi_event_batch(self):
        events = [_valid_payload() for _ in range(50)]
        batch = EventBatchIngest(events=events)
        assert len(batch.events) == 50

    def test_batch_at_max_limit(self):
        events = [_valid_payload() for _ in range(1000)]
        batch = EventBatchIngest(events=events)
        assert len(batch.events) == 1000

    def test_batch_exceeds_max_raises(self):
        events = [_valid_payload() for _ in range(1001)]
        with pytest.raises(ValidationError):
            EventBatchIngest(events=events)

    def test_empty_batch_raises(self):
        with pytest.raises(ValidationError):
            EventBatchIngest(events=[])

    def test_missing_events_key_raises(self):
        with pytest.raises((ValidationError, TypeError)):
            EventBatchIngest()

    def test_batch_with_invalid_event_raises(self):
        good = _valid_payload()
        bad = _valid_payload(severity="invalid_severity")
        with pytest.raises(ValidationError):
            EventBatchIngest(events=[good, bad])

    def test_batch_with_missing_required_field_raises(self):
        good = _valid_payload()
        bad = _valid_payload()
        del bad["event_id"]
        with pytest.raises(ValidationError):
            EventBatchIngest(events=[good, bad])

    def test_batch_events_field_must_be_list(self):
        with pytest.raises(ValidationError):
            EventBatchIngest(events="not-a-list")

    def test_batch_events_none_raises(self):
        with pytest.raises(ValidationError):
            EventBatchIngest(events=None)