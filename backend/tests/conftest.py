"""
Shared pytest configuration for the current SENTINEL-X regression suite.

The previous conftest targeted an older application API. The current suite
focuses on the live application architecture and does not require a second
database or authentication fixture layer.
"""

from __future__ import annotations

import pytest


@pytest.fixture
def sample_event_payload() -> dict:
    """Return a minimal canonical event payload."""
    return {
        "event_id": "pytest-event-001",
        "timestamp": "2026-01-01T00:00:00+00:00",
        "source": "auth",
        "event_type": "authentication.success",
        "severity": "low",
        "category": "authentication",
        "username": "test.user",
        "hostname": "test-host.corp.local",
    }


@pytest.fixture
def sample_dns_payload() -> dict:
    """Return a suspicious DNS event payload."""
    return {
        "event_id": "pytest-dns-001",
        "timestamp": "2026-01-01T00:00:00+00:00",
        "source": "dns",
        "event_type": "dns.query",
        "severity": "medium",
        "category": "dns",
        "source_ip": "10.0.2.8",
        "hostname": "dns-test.corp.local",
        "metadata": {
            "query_name": (
                "qw0gjr4ky6xhr9vttrn3seybixziwilq5lz667ey6315x."
                "tunnel-exfil-sim.example.com"
            ),
            "entropy_score": 4.98,
        },
    }