"""
Current SENTINEL-X regression tests.

These tests target the current application architecture rather than the
legacy module layout that existed before the application was consolidated.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.main import app
from app.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.detection.base_rule import DetectionContext
from app.detection.dns_rules import DnsSuspiciousDomainPatternRule
from app.detection.endpoint_rules import EndpointSuspiciousProcessRule
from app.detection.network_rules import NetSuspiciousPortRule
from app.detection.rule_registry import ALL_RULES
from app.models.event import Event
from app.schemas.event import EventIngest


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

def test_application_is_loaded():
    assert app.title == "SENTINEL-X"


def test_root_route_is_registered():
    paths = {route.path for route in app.routes}
    assert "/" in paths


def test_core_api_routes_are_registered():
    paths = {route.path for route in app.routes}

    assert any(path.startswith("/api/v1/auth") for path in paths)
    assert any(path.startswith("/api/v1/events") for path in paths)
    assert any(path.startswith("/api/v1/detections") for path in paths)
    assert any(path.startswith("/api/v1/incidents") for path in paths)
    assert any(path.startswith("/api/v1/analytics") for path in paths)
    assert any(path.startswith("/api/v1/ws") for path in paths)


# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------

def test_password_hash_and_verify():
    password = "pytest-password-123"

    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrong-password", hashed)


def test_access_token_round_trip():
    token = create_access_token(
        subject="pytest-user-id",
        extra_claims={"role": "analyst"},
    )

    payload = decode_token(token)

    assert payload["sub"] == "pytest-user-id"
    assert payload["type"] == "access"
    assert payload["role"] == "analyst"
    assert "iat" in payload
    assert "exp" in payload


# ---------------------------------------------------------------------------
# Event schema validation
# ---------------------------------------------------------------------------

def test_valid_event_schema(sample_event_payload):
    event = EventIngest.model_validate(sample_event_payload)

    assert event.event_id == "pytest-event-001"
    assert event.source == "auth"
    assert event.event_type == "authentication.success"
    assert event.severity == "low"


def test_invalid_event_severity_is_rejected(sample_event_payload):
    sample_event_payload["severity"] = "unknown"

    with pytest.raises(ValueError):
        EventIngest.model_validate(sample_event_payload)


def test_event_timestamp_is_datetime(sample_event_payload):
    event = EventIngest.model_validate(sample_event_payload)

    assert isinstance(event.timestamp, datetime)
    assert event.timestamp.tzinfo is not None


# ---------------------------------------------------------------------------
# Detection registry
# ---------------------------------------------------------------------------

def test_detection_registry_contains_expected_rules():
    rule_keys = {rule.rule_key for rule in ALL_RULES}

    expected = {
        "AUTH_REPEATED_FAILURES",
        "AUTH_BRUTE_FORCE",
        "AUTH_SUCCESS_AFTER_FAILURES",
        "NET_HIGH_CONNECTION_FREQUENCY",
        "NET_SUSPICIOUS_PORT",
        "NET_REPEATED_CONN_FAILURES",
        "ENDPOINT_SUSPICIOUS_PROCESS",
        "ENDPOINT_ABNORMAL_EXEC_RATE",
        "FILE_UNUSUAL_ACTIVITY",
        "DNS_EXCESSIVE_QUERIES",
        "DNS_SUSPICIOUS_DOMAIN_PATTERN",
    }

    assert expected.issubset(rule_keys)


def test_all_registered_rules_have_unique_keys():
    rule_keys = [rule.rule_key for rule in ALL_RULES]

    assert len(rule_keys) == len(set(rule_keys))


def test_all_registered_rules_have_metadata():
    for rule in ALL_RULES:
        assert rule.rule_key
        assert rule.name
        assert rule.category
        assert rule.description
        assert rule.default_severity
        assert isinstance(rule.default_threshold_config, dict)


# ---------------------------------------------------------------------------
# DNS detection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_suspicious_dns_rule_fires(sample_dns_payload):
    event = Event(
        id="pytest-db-id",
        event_id=sample_dns_payload["event_id"],
        timestamp=datetime.fromisoformat(sample_dns_payload["timestamp"]),
        ingested_at=datetime.now(timezone.utc),
        source=sample_dns_payload["source"],
        category=sample_dns_payload["category"],
        event_type=sample_dns_payload["event_type"],
        severity=sample_dns_payload["severity"],
        source_ip=sample_dns_payload["source_ip"],
        hostname=sample_dns_payload["hostname"],
        event_metadata=sample_dns_payload["metadata"],
        raw_payload=sample_dns_payload,
    )

    context = DetectionContext(
        db=None,
        config={
            "max_length": 40,
            "max_entropy": 3.7,
            "severity": "medium",
        },
    )

    result = await DnsSuspiciousDomainPatternRule().evaluate(
        event,
        context,
    )

    assert result is not None
    assert result.rule_key == "DNS_SUSPICIOUS_DOMAIN_PATTERN"
    assert "domain length" in result.reason


@pytest.mark.asyncio
async def test_normal_dns_rule_does_not_fire():
    event = Event(
        id="pytest-db-id-2",
        event_id="pytest-dns-normal",
        timestamp=datetime.now(timezone.utc),
        ingested_at=datetime.now(timezone.utc),
        source="dns",
        category="dns",
        event_type="dns.query",
        severity="low",
        source_ip="10.0.2.8",
        hostname="dns-test.corp.local",
        event_metadata={
            "query_name": "www.example.com",
            "entropy_score": 2.5,
        },
        raw_payload={},
    )

    context = DetectionContext(
        db=None,
        config={
            "max_length": 40,
            "max_entropy": 3.7,
            "severity": "medium",
        },
    )

    result = await DnsSuspiciousDomainPatternRule().evaluate(
        event,
        context,
    )

    assert result is None


# ---------------------------------------------------------------------------
# Endpoint detection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_suspicious_process_rule_fires():
    event = Event(
        id="pytest-process-id",
        event_id="pytest-process-001",
        timestamp=datetime.now(timezone.utc),
        ingested_at=datetime.now(timezone.utc),
        source="endpoint",
        category="process",
        event_type="process.start",
        severity="high",
        hostname="ws-test.corp.local",
        username="test.user",
        process_name="mimikatz",
        event_metadata={},
        raw_payload={},
    )

    context = DetectionContext(
        db=None,
        config={
            "suspicious_processes": [
                "nc",
                "netcat",
                "mimikatz",
                "psexec",
                "certutil",
                "wmic",
                "rundll32",
            ],
            "severity": "high",
        },
    )

    result = await EndpointSuspiciousProcessRule().evaluate(
        event,
        context,
    )

    assert result is not None
    assert result.rule_key == "ENDPOINT_SUSPICIOUS_PROCESS"
    assert "mimikatz" in result.reason


@pytest.mark.asyncio
async def test_normal_process_does_not_fire():
    event = Event(
        id="pytest-process-id-2",
        event_id="pytest-process-002",
        timestamp=datetime.now(timezone.utc),
        ingested_at=datetime.now(timezone.utc),
        source="endpoint",
        category="process",
        event_type="process.start",
        severity="low",
        hostname="ws-test.corp.local",
        username="test.user",
        process_name="notepad.exe",
        event_metadata={},
        raw_payload={},
    )

    context = DetectionContext(
        db=None,
        config={
            "suspicious_processes": [
                "nc",
                "netcat",
                "mimikatz",
                "psexec",
                "certutil",
                "wmic",
                "rundll32",
            ],
            "severity": "high",
        },
    )

    result = await EndpointSuspiciousProcessRule().evaluate(
        event,
        context,
    )

    assert result is None


# ---------------------------------------------------------------------------
# Network detection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_suspicious_port_rule_fires():
    event = Event(
        id="pytest-network-id",
        event_id="pytest-network-001",
        timestamp=datetime.now(timezone.utc),
        ingested_at=datetime.now(timezone.utc),
        source="network",
        category="network",
        event_type="network.connection",
        severity="medium",
        source_ip="10.0.2.8",
        destination_ip="10.0.1.10",
        destination_port=445,
        protocol="TCP",
        hostname="ws-test.corp.local",
        event_metadata={},
        raw_payload={},
    )

    context = DetectionContext(
        db=None,
        config={
            "watchlist_ports": [
                23,
                135,
                445,
                1433,
                3306,
                3389,
                4444,
                5900,
            ],
            "severity": "medium",
        },
    )

    result = await NetSuspiciousPortRule().evaluate(
        event,
        context,
    )

    assert result is not None
    assert result.rule_key == "NET_SUSPICIOUS_PORT"


@pytest.mark.asyncio
async def test_normal_port_does_not_fire():
    event = Event(
        id="pytest-network-id-2",
        event_id="pytest-network-002",
        timestamp=datetime.now(timezone.utc),
        ingested_at=datetime.now(timezone.utc),
        source="network",
        category="network",
        event_type="network.connection",
        severity="low",
        source_ip="10.0.2.8",
        destination_ip="10.0.1.10",
        destination_port=443,
        protocol="TCP",
        hostname="ws-test.corp.local",
        event_metadata={},
        raw_payload={},
    )

    context = DetectionContext(
        db=None,
        config={
            "watchlist_ports": [
                23,
                135,
                445,
                1433,
                3306,
                3389,
                4444,
                5900,
            ],
            "severity": "medium",
        },
    )

    result = await NetSuspiciousPortRule().evaluate(
        event,
        context,
    )

    assert result is None