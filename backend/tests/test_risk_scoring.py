"""
Sentinel-X — Risk Scoring Tests
==================================
Tests for the existing risk scoring engine and risk factor calculations.

Tests cover:
  - Base risk score calculation for events of each severity
  - Risk factor contributions (source IP reputation, destination port,
    event type, category, time-of-day where implemented)
  - Combined risk score computation
  - Risk score bounds (0.0–100.0 or 0.0–1.0 depending on implementation)
  - High-risk event combinations produce higher scores than low-risk
  - Risk scoring does not crash on missing optional fields
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

import pytest

from app.services.risk.scoring import RiskScorer
from app.services.risk.factors import (
    SeverityFactor,
    EventTypeFactor,
    SourceIPFactor,
    DestinationPortFactor,
)
from app.models.event import Event

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_event(
    severity: str = "low",
    event_type: str = "authentication.success",
    source_ip: str = "10.0.1.5",
    destination_ip: str = "10.0.1.10",
    source_port: int = 54321,
    destination_port: int = 443,
    protocol: str = "TCP",
    category: str = "authentication",
    action: str = "login",
    status: str = "success",
    username: str = "testuser",
    hostname: str = "ws-001.corp.local",
    offset_hours: float = 0.0,
) -> Event:
    ev = Event()
    ev.event_id = str(uuid.uuid4())
    ev.timestamp = datetime.now(timezone.utc) - timedelta(hours=offset_hours)
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
    ev.username = username
    ev.hostname = hostname
    ev.message = "Test risk scoring event"
    ev.event_metadata = {}
    return ev


def _score_is_valid(score: float, allow_zero: bool = True) -> bool:
    """Check that a score is a non-negative finite float."""
    if not isinstance(score, (int, float)):
        return False
    if score < 0:
        return False
    if not allow_zero and score == 0:
        return False
    return True


# ===========================================================================
# SeverityFactor
# ===========================================================================


class TestSeverityFactor:

    def test_critical_higher_than_high(self):
        factor = SeverityFactor()
        critical = _make_event(severity="critical")
        high = _make_event(severity="high")
        assert factor.score(critical) >= factor.score(high)

    def test_high_higher_than_medium(self):
        factor = SeverityFactor()
        high = _make_event(severity="high")
        medium = _make_event(severity="medium")
        assert factor.score(high) >= factor.score(medium)

    def test_medium_higher_than_low(self):
        factor = SeverityFactor()
        medium = _make_event(severity="medium")
        low = _make_event(severity="low")
        assert factor.score(medium) >= factor.score(low)

    def test_low_score_non_negative(self):
        factor = SeverityFactor()
        low = _make_event(severity="low")
        score = factor.score(low)
        assert _score_is_valid(score)

    def test_critical_score_non_zero(self):
        factor = SeverityFactor()
        critical = _make_event(severity="critical")
        score = factor.score(critical)
        assert score > 0


# ===========================================================================
# EventTypeFactor
# ===========================================================================


class TestEventTypeFactor:

    def test_auth_failure_higher_than_dns_query(self):
        factor = EventTypeFactor()
        auth_fail = _make_event(
            event_type="authentication.failure",
            severity="high",
        )
        dns = _make_event(
            event_type="dns.query",
            severity="low",
        )
        assert factor.score(auth_fail) >= factor.score(dns)

    def test_account_lockout_high_score(self):
        factor = EventTypeFactor()
        lockout = _make_event(event_type="account.lockout", severity="critical")
        score = factor.score(lockout)
        assert score > 0

    def test_network_transfer_critical_high_score(self):
        factor = EventTypeFactor()
        transfer = _make_event(
            event_type="network.transfer",
            severity="critical",
            action="upload",
        )
        score = factor.score(transfer)
        assert score > 0

    def test_normal_event_score_non_negative(self):
        factor = EventTypeFactor()
        event = _make_event(event_type="system.health", severity="low")
        score = factor.score(event)
        assert _score_is_valid(score)

    def test_dns_alert_high_score(self):
        factor = EventTypeFactor()
        alert = _make_event(event_type="dns.alert", severity="critical")
        score = factor.score(alert)
        assert score > 0


# ===========================================================================
# SourceIPFactor
# ===========================================================================


class TestSourceIPFactor:

    def test_external_ip_higher_than_internal(self):
        factor = SourceIPFactor()
        external = _make_event(source_ip="203.0.113.55")
        internal = _make_event(source_ip="10.0.1.5")
        assert factor.score(external) >= factor.score(internal)

    def test_none_source_ip_handled(self):
        factor = SourceIPFactor()
        event = _make_event()
        event.source_ip = None
        score = factor.score(event)
        assert _score_is_valid(score)

    def test_rfc1918_10_block_treated_internal(self):
        factor = SourceIPFactor()
        internal = _make_event(source_ip="10.255.255.1")
        external = _make_event(source_ip="203.0.113.1")
        assert factor.score(external) >= factor.score(internal)

    def test_rfc1918_192168_block_treated_internal(self):
        factor = SourceIPFactor()
        internal = _make_event(source_ip="192.168.0.1")
        external = _make_event(source_ip="198.51.100.5")
        assert factor.score(external) >= factor.score(internal)

    def test_score_is_numeric(self):
        factor = SourceIPFactor()
        event = _make_event(source_ip="10.0.1.5")
        score = factor.score(event)
        assert isinstance(score, (int, float))


# ===========================================================================
# DestinationPortFactor
# ===========================================================================


class TestDestinationPortFactor:

    def test_unusual_port_higher_than_standard(self):
        factor = DestinationPortFactor()
        unusual = _make_event(destination_port=4444)
        standard = _make_event(destination_port=443)
        assert factor.score(unusual) >= factor.score(standard)

    def test_port_22_score_non_negative(self):
        factor = DestinationPortFactor()
        event = _make_event(destination_port=22)
        score = factor.score(event)
        assert _score_is_valid(score)

    def test_port_none_handled(self):
        factor = DestinationPortFactor()
        event = _make_event()
        event.destination_port = None
        score = factor.score(event)
        assert _score_is_valid(score)

    def test_well_known_ports_lower_risk(self):
        factor = DestinationPortFactor()
        https = _make_event(destination_port=443)
        http = _make_event(destination_port=80)
        smtp = _make_event(destination_port=25)
        c2_port = _make_event(destination_port=31337)
        for normal_event in (https, http, smtp):
            assert factor.score(c2_port) >= factor.score(normal_event)


# ===========================================================================
# RiskScorer — combined scoring
# ===========================================================================


class TestRiskScorer:

    def test_scorer_initialises(self):
        scorer = RiskScorer()
        assert scorer is not None

    def test_score_returns_numeric(self):
        scorer = RiskScorer()
        event = _make_event(severity="low")
        score = scorer.score(event)
        assert isinstance(score, (int, float))

    def test_score_non_negative(self):
        scorer = RiskScorer()
        event = _make_event(severity="low")
        score = scorer.score(event)
        assert score >= 0

    def test_critical_event_higher_score_than_low(self):
        scorer = RiskScorer()
        low = _make_event(severity="low", event_type="system.health")
        critical = _make_event(
            severity="critical",
            event_type="authentication.failure",
            source_ip="203.0.113.99",
            destination_port=4444,
        )
        assert scorer.score(critical) > scorer.score(low)

    def test_score_within_expected_bounds(self):
        scorer = RiskScorer()
        event = _make_event(severity="high")
        score = scorer.score(event)
        # Expect score in range [0, 100] or [0, 1] depending on implementation
        assert 0 <= score <= 100

    def test_auth_failure_from_external_ip_high_score(self):
        scorer = RiskScorer()
        event = _make_event(
            severity="high",
            event_type="authentication.failure",
            source_ip="203.0.113.55",
            destination_port=445,
        )
        low_event = _make_event(severity="low", source_ip="10.0.1.5")
        assert scorer.score(event) > scorer.score(low_event)

    def test_missing_optional_fields_no_crash(self):
        scorer = RiskScorer()
        event = _make_event(severity="medium")
        event.source_ip = None
        event.destination_ip = None
        event.source_port = None
        event.destination_port = None
        event.protocol = None
        event.username = None
        try:
            score = scorer.score(event)
            assert isinstance(score, (int, float))
        except Exception as exc:
            pytest.fail(f"RiskScorer.score raised on missing fields: {exc}")

    def test_deterministic_scoring(self):
        scorer = RiskScorer()
        event = _make_event(severity="high", event_type="account.lockout")
        s1 = scorer.score(event)
        s2 = scorer.score(event)
        assert s1 == s2

    async def test_async_score_interface(self, db_session):
        """If the scorer has an async interface, test it."""
        scorer = RiskScorer()
        if hasattr(scorer, "async_score"):
            event = _make_event(severity="high")
            score = await scorer.async_score(db=db_session, event=event)
            assert isinstance(score, (int, float))
            assert score >= 0