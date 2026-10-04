"""
Brute Force Detection Scenario
================================
Simulates the telemetry signature of a password brute-force attack
against a corporate authentication service, as *observed* by a SIEM
or authentication log collector.

This scenario generates DEFENSIVE TELEMETRY ONLY — it does not perform
any actual authentication attempts, network scanning, or credential
testing.  It produces synthetic log records that an analyst would see
in a real environment when a brute force event occurs.

Event types produced:
  - authentication.failure    (many, high rate, same target)
  - authentication.success    (one final, after many failures)
  - account.lockout           (optional, triggered by threshold)

Severity:
  - authentication.failure → medium (early) → high (escalating)
  - authentication.success  → high  (anomalous success after failures)
  - account.lockout         → critical
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

# ---------------------------------------------------------------------------
# Static pools
# ---------------------------------------------------------------------------

_ATTACKER_IPS = [
    "203.0.113.55",
    "198.51.100.99",
    "192.0.2.200",
    "203.0.113.120",
    "198.51.100.44",
]

_TARGET_USERS = [
    "administrator",
    "admin",
    "svc_backup",
    "helpdesk",
    "root",
    "alice.johnson",
    "bob.smith",
]

_TARGET_HOSTS = [
    "dc01.corp.local",
    "vpn-gateway.corp.local",
    "mailserver.corp.local",
    "appserver01.corp.local",
]

_AUTH_SOURCES = [
    "auth",
    "vpn-gateway",
    "web-auth",
]

_LOCKOUT_THRESHOLD = 10  # failures before lockout event is generated


def _ts_iso(base_dt: datetime, offset_seconds: float) -> str:
    return (base_dt + timedelta(seconds=offset_seconds)).isoformat()


def _event_base(
    source: str,
    event_type: str,
    severity: str,
    timestamp_iso: str,
) -> dict[str, Any]:
    return {
        "event_id": str(uuid.uuid4()),
        "timestamp": timestamp_iso,
        "source": source,
        "event_type": event_type,
        "severity": severity,
    }


# ---------------------------------------------------------------------------
# Event builders
# ---------------------------------------------------------------------------


def _auth_failure(
    attacker_ip: str,
    target_user: str,
    target_host: str,
    source: str,
    timestamp_iso: str,
    attempt_number: int,
) -> dict[str, Any]:
    if attempt_number < 5:
        severity = "medium"
    elif attempt_number < 15:
        severity = "high"
    else:
        severity = "critical"

    ev = _event_base(source, "authentication.failure", severity, timestamp_iso)
    ev.update(
        {
            "category": "authentication",
            "username": target_user,
            "hostname": target_host,
            "source_ip": attacker_ip,
            "destination_ip": _random_server_ip(),
            "destination_port": _auth_port(source),
            "protocol": "TCP",
            "action": "login",
            "status": "failure",
            "message": (
                f"Authentication failure for user '{target_user}' "
                f"from {attacker_ip} (attempt #{attempt_number})"
            ),
            "metadata": {
                "failure_reason": random.choice(
                    [
                        "invalid_password",
                        "invalid_credentials",
                        "wrong_password",
                    ]
                ),
                "attempt_number": attempt_number,
                "logon_type": _logon_type(source),
                "auth_method": random.choice(["ntlm", "kerberos", "form"]),
            },
        }
    )
    return ev


def _auth_success_after_brute(
    attacker_ip: str,
    target_user: str,
    target_host: str,
    source: str,
    timestamp_iso: str,
    total_failures: int,
) -> dict[str, Any]:
    ev = _event_base(source, "authentication.success", "high", timestamp_iso)
    ev.update(
        {
            "category": "authentication",
            "username": target_user,
            "hostname": target_host,
            "source_ip": attacker_ip,
            "destination_ip": _random_server_ip(),
            "destination_port": _auth_port(source),
            "protocol": "TCP",
            "action": "login",
            "status": "success",
            "message": (
                f"Authentication SUCCESS for '{target_user}' from {attacker_ip} "
                f"after {total_failures} failures — possible credential compromise"
            ),
            "metadata": {
                "prior_failures": total_failures,
                "logon_type": _logon_type(source),
                "auth_method": "ntlm",
                "anomaly_note": "success_after_brute_force",
            },
        }
    )
    return ev


def _account_lockout(
    target_user: str,
    target_host: str,
    source: str,
    timestamp_iso: str,
    failure_count: int,
) -> dict[str, Any]:
    ev = _event_base(source, "account.lockout", "critical", timestamp_iso)
    ev.update(
        {
            "category": "authentication",
            "username": target_user,
            "hostname": target_host,
            "action": "lockout",
            "status": "locked",
            "message": (
                f"Account '{target_user}' locked after {failure_count} "
                f"consecutive authentication failures"
            ),
            "metadata": {
                "failure_count": failure_count,
                "lockout_policy": "10-failed-attempts",
                "requires_admin_unlock": True,
            },
        }
    )
    return ev


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _random_server_ip() -> str:
    servers = ["10.0.1.10", "10.0.1.11", "10.0.2.20", "192.168.10.1"]
    return random.choice(servers)


def _auth_port(source: str) -> int:
    mapping = {
        "auth": 445,
        "vpn-gateway": 443,
        "web-auth": 443,
    }
    return mapping.get(source, 443)


def _logon_type(source: str) -> str:
    if source == "auth":
        return random.choice(["network", "interactive"])
    if source == "vpn-gateway":
        return "vpn"
    return "web_form"


# ---------------------------------------------------------------------------
# Public scenario interface
# ---------------------------------------------------------------------------


def generate_scenario(
    failure_count: int = 20,
    include_success: bool = True,
    include_lockout: bool = True,
) -> list[dict[str, Any]]:
    """
    Generate a brute force telemetry sequence.

    The sequence is chronologically coherent:
      - All failure events are spaced 2–5 seconds apart, advancing a
        single cursor so every timestamp is strictly greater than the last.
      - The lockout event (when included) is placed 1 second after the
        final failure event timestamp.
      - The success event (when included) is placed 5–30 seconds after
        the lockout timestamp (if lockout) or the final failure timestamp.

    Parameters
    ----------
    failure_count:
        Number of authentication failure events to generate (2–200).
    include_success:
        If True, append one anomalous authentication success at the end.
    include_lockout:
        If True, include an account lockout event when failures exceed
        _LOCKOUT_THRESHOLD.

    Returns
    -------
    List of event dicts ordered chronologically.
    """
    failure_count = max(2, min(failure_count, 200))

    attacker_ip = random.choice(_ATTACKER_IPS)
    target_user = random.choice(_TARGET_USERS)
    target_host = random.choice(_TARGET_HOSTS)
    source = random.choice(_AUTH_SOURCES)

    # Anchor: place the first failure event in the recent past so the
    # whole sequence ends close to "now".
    # Total span ≈ failure_count × avg(3.5 s) ≈ 20 events → ~70 s back.
    avg_interval = 3.5
    total_span = failure_count * avg_interval
    base_dt = datetime.now(timezone.utc) - timedelta(seconds=total_span)

    events: list[dict[str, Any]] = []

    # ── Phase 1: Authentication failures ────────────────────────────────
    # cursor_seconds tracks the elapsed time from base_dt.
    # Each failure advances it by a fresh random interval so timestamps
    # are monotonically increasing without any secondary random call
    # contaminating last_offset.
    cursor_seconds = 0.0

    for i in range(1, failure_count + 1):
        ts = _ts_iso(base_dt, cursor_seconds)
        events.append(
            _auth_failure(
                attacker_ip,
                target_user,
                target_host,
                source,
                ts,
                attempt_number=i,
            )
        )
        # Advance cursor after recording this event's timestamp
        cursor_seconds += random.uniform(2.0, 5.0)

    # cursor_seconds now sits just past the final failure timestamp.
    # All subsequent events are anchored to this single cursor value.

    # ── Phase 2: Account lockout ─────────────────────────────────────────
    if include_lockout and failure_count >= _LOCKOUT_THRESHOLD:
        lockout_ts = _ts_iso(base_dt, cursor_seconds + 1.0)
        events.append(
            _account_lockout(
                target_user,
                target_host,
                source,
                lockout_ts,
                failure_count,
            )
        )
        # Push cursor past the lockout event
        cursor_seconds += 1.0

    # ── Phase 3: Anomalous success ────────────────────────────────────────
    if include_success:
        # Success occurs 5–30 s after whatever happened last
        success_offset = cursor_seconds + random.uniform(5.0, 30.0)
        success_ts = _ts_iso(base_dt, success_offset)
        events.append(
            _auth_success_after_brute(
                attacker_ip,
                target_user,
                target_host,
                source,
                success_ts,
                failure_count,
            )
        )

    # The construction above guarantees chronological order, but we sort
    # as a defensive measure in case future changes reorder phases.
    events.sort(key=lambda e: e["timestamp"])
    return events


def generate_event() -> dict[str, Any]:
    """Return a single authentication failure event (for mixed streams)."""
    attacker_ip = random.choice(_ATTACKER_IPS)
    target_user = random.choice(_TARGET_USERS)
    target_host = random.choice(_TARGET_HOSTS)
    source = random.choice(_AUTH_SOURCES)
    ts = datetime.now(timezone.utc).isoformat()
    return _auth_failure(
        attacker_ip, target_user, target_host, source,
        ts, attempt_number=random.randint(1, 30)
    )