"""
Account Compromise Scenario
=============================
Simulates the telemetry signature of a compromised user account.

Observed behaviours modelled as DEFENSIVE TELEMETRY:
  1. Login from unusual/new geography or IP
  2. Rapid privilege enumeration (LDAP queries)
  3. Access to sensitive file shares
  4. New process execution not seen for this user before
  5. Outbound data staging (large upload / unusual destination)
  6. Optional: lateral movement attempt (login to internal server)

This scenario generates SYNTHETIC DEFENSIVE TELEMETRY ONLY.
No real credentials, networks, or systems are used.

Event types:
  - authentication.success   (from unusual source)
  - ldap.query               (enumeration)
  - file.access              (sensitive paths)
  - process.start            (reconnaissance tool simulation)
  - network.transfer         (data staging)
  - authentication.success   (lateral movement — internal)

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

_COMPROMISED_USERS = [
    "alice.johnson",
    "dave.brown",
    "svc_backup",
    "helpdesk",
]

_UNUSUAL_IPS = [
    "203.0.113.77",
    "198.51.100.32",
    "192.0.2.88",
]

_INTERNAL_IPS = [
    "10.0.1.45",
    "10.0.2.99",
    "192.168.10.55",
]

_SENSITIVE_PATHS = [
    r"\\fileserver01\finance\payroll.xlsx",
    r"\\fileserver01\hr\employee_records.csv",
    r"\\fileserver01\exec\board_minutes.docx",
    r"\\dc01\SYSVOL\corp.local\Policies",
    r"C:\ProgramData\configs\service_credentials.config",
]

_LATERAL_TARGETS = [
    "dc01.corp.local",
    "fileserver01.corp.local",
    "appserver01.corp.local",
    "backup-server.corp.local",
]

_STAGING_DESTINATIONS = [
    "203.0.113.200",
    "198.51.100.150",
    "192.0.2.111",
]

_RECON_PROCESSES = [
    "net.exe",
    "whoami.exe",
    "nltest.exe",
    "arp.exe",
    "ipconfig.exe",
]

_WORKSTATIONS = [f"ws-{i:03d}.corp.local" for i in range(1, 31)]


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
# Phase builders
# ---------------------------------------------------------------------------


def _initial_login(
    user: str, src_ip: str, host: str, offset: float
) -> dict[str, Any]:
    ev = _event_base("auth", "authentication.success", "medium", offset)
    ev.update(
        {
            "category": "authentication",
            "username": user,
            "hostname": host,
            "source_ip": src_ip,
            "destination_port": 445,
            "protocol": "TCP",
            "action": "login",
            "status": "success",
            "message": (
                f"Login for '{user}' from unusual source IP {src_ip}"
            ),
            "metadata": {
                "logon_type": "network",
                "auth_method": "ntlm",
                "geo_unusual": True,
                "first_seen_ip": True,
            },
        }
    )
    return ev


def _ldap_enumeration(
    user: str, src_ip: str, host: str, offset: float, query_num: int
) -> dict[str, Any]:
    queries = [
        "(objectClass=user)",
        "(memberOf=CN=Domain Admins,CN=Users,DC=corp,DC=local)",
        "(objectClass=computer)",
        "(objectClass=group)",
        "(&(objectClass=user)(adminCount=1))",
    ]
    ev = _event_base("auth", "ldap.query", "high", offset)
    ev.update(
        {
            "category": "authentication",
            "username": user,
            "hostname": host,
            "source_ip": src_ip,
            "destination_ip": "10.0.1.10",
            "destination_port": 389,
            "protocol": "LDAP",
            "action": "query",
            "status": "success",
            "message": f"LDAP enumeration query by '{user}'",
            "metadata": {
                "ldap_filter": queries[query_num % len(queries)],
                "result_count": random.randint(5, 500),
                "query_sequence": query_num,
            },
        }
    )
    return ev


def _sensitive_file_access(
    user: str, src_ip: str, host: str, offset: float
) -> dict[str, Any]:
    path = random.choice(_SENSITIVE_PATHS)
    ev = _event_base("endpoint", "file.access", "high", offset)
    ev.update(
        {
            "category": "file",
            "username": user,
            "hostname": host,
            "source_ip": src_ip,
            "action": "read",
            "status": "success",
            "message": f"Sensitive file accessed by '{user}': {path}",
            "metadata": {
                "file_path": path,
                "file_size_bytes": random.randint(50_000, 5_000_000),
                "sensitivity": "high",
                "process": "explorer.exe",
            },
        }
    )
    return ev


def _recon_process(
    user: str, host: str, offset: float
) -> dict[str, Any]:
    process = random.choice(_RECON_PROCESSES)
    ev = _event_base("endpoint", "process.start", "high", offset)
    ev.update(
        {
            "category": "process",
            "username": user,
            "hostname": host,
            "process_name": process,
            "action": "start",
            "status": "success",
            "message": f"Reconnaissance-associated process started by '{user}': {process}",
            "metadata": {
                "pid": random.randint(1000, 60000),
                "parent_process": "cmd.exe",
                "command_line": f"{process} /domain",
                "anomaly_note": "recon_tool_unusual_context",
            },
        }
    )
    return ev


def _data_staging(
    user: str, src_ip: str, host: str, offset: float
) -> dict[str, Any]:
    dest_ip = random.choice(_STAGING_DESTINATIONS)
    bytes_sent = random.randint(50_000_000, 500_000_000)  # 50 MB – 500 MB
    ev = _event_base("network", "network.transfer", "critical", offset)
    ev.update(
        {
            "category": "network",
            "username": user,
            "hostname": host,
            "source_ip": src_ip,
            "destination_ip": dest_ip,
            "source_port": random.randint(49152, 65535),
            "destination_port": random.choice([443, 8443, 22]),
            "protocol": "TCP",
            "action": "upload",
            "status": "success",
            "message": (
                f"Large outbound transfer by '{user}' to {dest_ip} "
                f"({bytes_sent // 1_000_000} MB) — possible data staging"
            ),
            "metadata": {
                "bytes_sent": bytes_sent,
                "bytes_received": random.randint(500, 5000),
                "duration_seconds": random.randint(30, 300),
                "anomaly_note": "large_outbound_unusual_destination",
            },
        }
    )
    return ev


def _lateral_movement(
    user: str, src_ip: str, offset: float
) -> dict[str, Any]:
    target = random.choice(_LATERAL_TARGETS)
    ev = _event_base("auth", "authentication.success", "critical", offset)
    ev.update(
        {
            "category": "authentication",
            "username": user,
            "hostname": target,
            "source_ip": src_ip,
            "destination_ip": "10.0.1.10",
            "destination_port": 445,
            "protocol": "SMB",
            "action": "login",
            "status": "success",
            "message": (
                f"Lateral movement: '{user}' authenticated to {target} "
                f"from {src_ip}"
            ),
            "metadata": {
                "logon_type": "network",
                "auth_method": random.choice(["ntlm", "kerberos"]),
                "target_host": target,
                "anomaly_note": "lateral_movement_detected",
            },
        }
    )
    return ev


# ---------------------------------------------------------------------------
# Public scenario interface
# ---------------------------------------------------------------------------


def generate_scenario(
    include_lateral: bool = True,
) -> list[dict[str, Any]]:
    """
    Generate an account compromise telemetry sequence.

    Returns events ordered chronologically.
    """
    user = random.choice(_COMPROMISED_USERS)
    src_ip = random.choice(_UNUSUAL_IPS)
    host = random.choice(_WORKSTATIONS)

    events: list[dict[str, Any]] = []
    offset = -300.0  # start 5 minutes in the past

    # Phase 1 — Initial login from unusual source
    events.append(_initial_login(user, src_ip, host, offset))
    offset += random.uniform(10.0, 30.0)

    # Phase 2 — LDAP enumeration (3–6 queries)
    num_queries = random.randint(3, 6)
    for i in range(num_queries):
        events.append(_ldap_enumeration(user, src_ip, host, offset, i))
        offset += random.uniform(3.0, 10.0)

    # Phase 3 — Reconnaissance processes (1–3)
    for _ in range(random.randint(1, 3)):
        events.append(_recon_process(user, host, offset))
        offset += random.uniform(5.0, 15.0)

    # Phase 4 — Sensitive file access (2–4)
    for _ in range(random.randint(2, 4)):
        events.append(_sensitive_file_access(user, src_ip, host, offset))
        offset += random.uniform(10.0, 30.0)

    # Phase 5 — Data staging
    events.append(_data_staging(user, src_ip, host, offset))
    offset += random.uniform(30.0, 60.0)

    # Phase 6 — Lateral movement (optional)
    if include_lateral:
        events.append(_lateral_movement(user, src_ip, offset))

    events.sort(key=lambda e: e["timestamp"])
    return events


def generate_event() -> dict[str, Any]:
    """Return a single suspicious event for mixed-stream use."""
    user = random.choice(_COMPROMISED_USERS)
    src_ip = random.choice(_UNUSUAL_IPS)
    host = random.choice(_WORKSTATIONS)
    return random.choice(
        [
            _initial_login(user, src_ip, host, 0.0),
            _sensitive_file_access(user, src_ip, host, 0.0),
            _recon_process(user, host, 0.0),
        ]
    )