"""
Network Anomaly Scenario
=========================
Simulates anomalous network telemetry as observed by network sensors
and firewalls — DEFENSIVE TELEMETRY ONLY.

Patterns modelled:
  1. Port scanning activity detected by firewall (many REJECT/DROP events
     from one source across many destination ports)
  2. Beaconing pattern (regular low-interval connections to single dest)
  3. Unusual protocol / port combination
  4. Large inbound data transfer (potential exfiltration or C2 staging)

This generates SYNTHETIC LOG RECORDS representing what a SIEM would see.
No actual network scanning or connection is performed.

Event types:
  - network.connection.blocked   (port scan drops)
  - network.connection           (beaconing)
  - network.transfer             (unusual data volume)
  - firewall.alert               (rule trigger)

Severity: medium → high → critical
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

# ---------------------------------------------------------------------------
# Static pools
# ---------------------------------------------------------------------------

_SCANNING_SOURCES = [
    "203.0.113.33",
    "198.51.100.77",
    "192.0.2.14",
]

_INTERNAL_TARGETS = [
    "10.0.1.10",
    "10.0.1.11",
    "10.0.2.20",
    "192.168.10.5",
]

_BEACON_DESTINATIONS = [
    "203.0.113.90",
    "198.51.100.110",
    "192.0.2.55",
]

_INTERNAL_HOSTS = [f"ws-{i:03d}.corp.local" for i in range(1, 31)]
_SERVERS = ["dc01.corp.local", "fileserver01.corp.local", "appserver01.corp.local"]

_UNUSUAL_PORTS = [4444, 8080, 1337, 31337, 9001, 6666, 1234]

_WELL_KNOWN_PORTS = list(range(1, 1024))


def _now_iso(offset_seconds: float = 0.0) -> str:
    ts = datetime.now(timezone.utc) + timedelta(seconds=offset_seconds)
    return ts.isoformat()


def _event_base(
    source: str,
    event_type: str,
    severity: str,
    offset_seconds: float = 0.0,
) -> dict[str, Any]:
    return {
        "event_id": str(uuid.uuid4()),
        "timestamp": _now_iso(offset_seconds),
        "source": source,
        "event_type": event_type,
        "severity": severity,
    }


# ---------------------------------------------------------------------------
# Pattern builders
# ---------------------------------------------------------------------------


def _port_scan_block(
    src_ip: str,
    dst_ip: str,
    dst_port: int,
    offset: float,
    scan_number: int,
) -> dict[str, Any]:
    severity = "medium" if scan_number < 20 else "high"
    ev = _event_base("firewall", "network.connection.blocked", severity, offset)
    ev.update(
        {
            "category": "network",
            "source_ip": src_ip,
            "destination_ip": dst_ip,
            "source_port": random.randint(49152, 65535),
            "destination_port": dst_port,
            "protocol": "TCP",
            "action": "block",
            "status": "blocked",
            "message": (
                f"Firewall blocked connection from {src_ip} to "
                f"{dst_ip}:{dst_port} (scan attempt #{scan_number})"
            ),
            "metadata": {
                "rule_id": "FW-DROP-PORTSCAN",
                "direction": "inbound",
                "scan_sequence": scan_number,
                "tcp_flags": "SYN",
            },
        }
    )
    return ev


def _firewall_scan_alert(
    src_ip: str,
    dst_ip: str,
    offset: float,
    port_count: int,
) -> dict[str, Any]:
    ev = _event_base("firewall", "firewall.alert", "critical", offset)
    ev.update(
        {
            "category": "network",
            "source_ip": src_ip,
            "destination_ip": dst_ip,
            "action": "alert",
            "status": "triggered",
            "message": (
                f"Port scan detected from {src_ip} — "
                f"{port_count} unique ports probed on {dst_ip}"
            ),
            "metadata": {
                "rule_name": "PORTSCAN_DETECTION",
                "ports_probed": port_count,
                "alert_threshold": 15,
                "action_taken": "logged_and_alerted",
            },
        }
    )
    return ev


def _beacon_connection(
    src_host: str,
    src_ip: str,
    dst_ip: str,
    offset: float,
    beacon_num: int,
) -> dict[str, Any]:
    ev = _event_base("network", "network.connection", "high", offset)
    ev.update(
        {
            "category": "network",
            "hostname": src_host,
            "source_ip": src_ip,
            "destination_ip": dst_ip,
            "source_port": random.randint(49152, 65535),
            "destination_port": random.choice([443, 80, 8080]),
            "protocol": "TCP",
            "action": "connect",
            "status": "allowed",
            "message": (
                f"Periodic beacon connection from {src_host} to {dst_ip} "
                f"(interval #{beacon_num})"
            ),
            "metadata": {
                "bytes_sent": random.randint(200, 800),
                "bytes_received": random.randint(100, 500),
                "duration_ms": random.randint(50, 200),
                "beacon_interval_seconds": random.randint(55, 65),
                "beacon_sequence": beacon_num,
                "anomaly_note": "regular_beacon_pattern",
            },
        }
    )
    return ev


def _unusual_transfer(
    src_host: str,
    src_ip: str,
    dst_ip: str,
    offset: float,
) -> dict[str, Any]:
    port = random.choice(_UNUSUAL_PORTS)
    bytes_sent = random.randint(100_000_000, 1_000_000_000)  # 100 MB – 1 GB
    ev = _event_base("network", "network.transfer", "critical", offset)
    ev.update(
        {
            "category": "network",
            "hostname": src_host,
            "source_ip": src_ip,
            "destination_ip": dst_ip,
            "source_port": random.randint(49152, 65535),
            "destination_port": port,
            "protocol": "TCP",
            "action": "upload",
            "status": "allowed",
            "message": (
                f"Anomalous large transfer from {src_host} ({src_ip}) "
                f"to {dst_ip}:{port} — {bytes_sent // 1_000_000} MB"
            ),
            "metadata": {
                "bytes_sent": bytes_sent,
                "bytes_received": random.randint(1000, 10000),
                "duration_seconds": random.randint(60, 600),
                "port_unusual": True,
                "anomaly_note": "large_transfer_unusual_port",
            },
        }
    )
    return ev


# ---------------------------------------------------------------------------
# Public scenario interface
# ---------------------------------------------------------------------------


def generate_port_scan_scenario(probe_count: int = 30) -> list[dict[str, Any]]:
    """Generate port scan detection telemetry (probe_count blocked connections)."""
    probe_count = max(5, min(probe_count, 200))
    src_ip = random.choice(_SCANNING_SOURCES)
    dst_ip = random.choice(_INTERNAL_TARGETS)

    ports = random.sample(_WELL_KNOWN_PORTS, min(probe_count, len(_WELL_KNOWN_PORTS)))
    events: list[dict[str, Any]] = []
    offset = -120.0

    for i, port in enumerate(ports):
        events.append(
            _port_scan_block(src_ip, dst_ip, port, offset, i + 1)
        )
        offset += random.uniform(0.1, 0.5)

    # Aggregate alert
    events.append(_firewall_scan_alert(src_ip, dst_ip, offset, len(ports)))

    events.sort(key=lambda e: e["timestamp"])
    return events


def generate_beacon_scenario(beacon_count: int = 10) -> list[dict[str, Any]]:
    """Generate beaconing telemetry (regular periodic connections)."""
    beacon_count = max(3, min(beacon_count, 100))
    src_host = random.choice(_INTERNAL_HOSTS)
    src_ip = f"10.0.{random.randint(1,3)}.{random.randint(1,254)}"
    dst_ip = random.choice(_BEACON_DESTINATIONS)

    events: list[dict[str, Any]] = []
    # Spread across last hour with ~60s interval
    offset = -(beacon_count * 60.0)

    for i in range(beacon_count):
        events.append(
            _beacon_connection(src_host, src_ip, dst_ip, offset, i + 1)
        )
        offset += 60.0 + random.uniform(-5.0, 5.0)

    events.sort(key=lambda e: e["timestamp"])
    return events


def generate_scenario() -> list[dict[str, Any]]:
    """Generate a composite network anomaly scenario."""
    choice = random.choice(["portscan", "beacon", "transfer"])

    if choice == "portscan":
        return generate_port_scan_scenario(random.randint(15, 50))
    elif choice == "beacon":
        return generate_beacon_scenario(random.randint(6, 20))
    else:
        src_host = random.choice(_INTERNAL_HOSTS)
        src_ip = f"10.0.{random.randint(1,3)}.{random.randint(1,254)}"
        dst_ip = random.choice(_BEACON_DESTINATIONS)
        return [_unusual_transfer(src_host, src_ip, dst_ip, 0.0)]


def generate_event() -> dict[str, Any]:
    """Return a single network anomaly event for mixed streams."""
    src_ip = random.choice(_SCANNING_SOURCES)
    dst_ip = random.choice(_INTERNAL_TARGETS)
    return _port_scan_block(src_ip, dst_ip, random.randint(1, 1024), 0.0, 1)