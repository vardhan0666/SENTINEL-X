"""
Normal Baseline Scenario
========================
Generates realistic background telemetry representing healthy,
expected activity in a corporate environment.

Event types produced:
  - authentication.success     (user login)
  - file.access                (document reads)
  - network.connection         (outbound HTTPS)
  - process.start              (common system processes)
  - dns.query                  (standard domain lookups)
  - system.health              (heartbeat)

All events carry severity=low and are safe synthetic data.
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from typing import Any

from faker import Faker

fake = Faker()

# ---------------------------------------------------------------------------
# Static pools — representative but entirely synthetic
# ---------------------------------------------------------------------------

_USERS = [
    "alice.johnson",
    "bob.smith",
    "carol.white",
    "dave.brown",
    "eve.davis",
    "frank.miller",
    "grace.wilson",
    "henry.moore",
    "iris.taylor",
    "jack.anderson",
]

_WORKSTATIONS = [f"ws-{i:03d}.corp.local" for i in range(1, 31)]

_SERVERS = [
    "dc01.corp.local",
    "fileserver01.corp.local",
    "appserver01.corp.local",
    "mailserver.corp.local",
    "proxy01.corp.local",
]

_INTERNAL_SUBNETS = ["10.0.1", "10.0.2", "10.0.3", "192.168.10"]

_EXTERNAL_IPS = [
    "203.0.113.10",
    "198.51.100.5",
    "93.184.216.34",  # example.com
    "151.101.1.140",  # fastly
    "13.33.90.45",    # AWS CloudFront
]

_COMMON_PROCESSES = [
    "chrome.exe",
    "outlook.exe",
    "explorer.exe",
    "teams.exe",
    "svchost.exe",
    "winlogon.exe",
    "lsass.exe",
    "services.exe",
    "python.exe",
    "java.exe",
    "node.exe",
    "powershell.exe",
    "cmd.exe",
]

_COMMON_DOMAINS = [
    "microsoft.com",
    "office365.com",
    "teams.microsoft.com",
    "google.com",
    "github.com",
    "stackoverflow.com",
    "amazonaws.com",
    "update.example.corp",
    "ntp.example.corp",
    "ldap.corp.local",
]

_DOCUMENT_PATHS = [
    r"C:\Users\{user}\Documents\report_q1.docx",
    r"C:\Users\{user}\Downloads\invoice.pdf",
    r"\\fileserver01\shared\hr\policy.pdf",
    r"\\fileserver01\shared\finance\budget.xlsx",
    r"C:\Users\{user}\Desktop\notes.txt",
    r"C:\ProgramData\configs\app.config",
]


def _internal_ip() -> str:
    subnet = random.choice(_INTERNAL_SUBNETS)
    return f"{subnet}.{random.randint(1, 254)}"


def _event_base(source: str, event_type: str, severity: str = "low") -> dict[str, Any]:
    return {
        "event_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "event_type": event_type,
        "severity": severity,
    }


# ---------------------------------------------------------------------------
# Individual event generators
# ---------------------------------------------------------------------------


def auth_success() -> dict[str, Any]:
    user = random.choice(_USERS)
    host = random.choice(_WORKSTATIONS)
    ev = _event_base("auth", "authentication.success", "low")
    ev.update(
        {
            "category": "authentication",
            "username": user,
            "hostname": host,
            "source_ip": _internal_ip(),
            "action": "login",
            "status": "success",
            "message": f"User {user} authenticated successfully on {host}",
            "metadata": {
                "logon_type": random.choice(["interactive", "network", "remote_interactive"]),
                "auth_method": random.choice(["kerberos", "ntlm"]),
            },
        }
    )
    return ev


def file_access() -> dict[str, Any]:
    user = random.choice(_USERS)
    host = random.choice(_WORKSTATIONS)
    path_template = random.choice(_DOCUMENT_PATHS)
    path = path_template.format(user=user)
    ev = _event_base("endpoint", "file.access", "low")
    ev.update(
        {
            "category": "file",
            "username": user,
            "hostname": host,
            "source_ip": _internal_ip(),
            "action": random.choice(["read", "open"]),
            "status": "success",
            "message": f"File accessed: {path}",
            "metadata": {
                "file_path": path,
                "file_size_bytes": random.randint(1024, 10_485_760),
                "process": random.choice(["explorer.exe", "winword.exe", "excel.exe", "adobe.exe"]),
            },
        }
    )
    return ev


def network_connection() -> dict[str, Any]:
    host = random.choice(_WORKSTATIONS)
    ev = _event_base("network", "network.connection", "low")
    ev.update(
        {
            "category": "network",
            "hostname": host,
            "source_ip": _internal_ip(),
            "destination_ip": random.choice(_EXTERNAL_IPS),
            "source_port": random.randint(49152, 65535),
            "destination_port": random.choice([443, 80, 8443]),
            "protocol": random.choice(["TCP", "HTTPS"]),
            "action": "connect",
            "status": "allowed",
            "message": "Outbound connection established",
            "metadata": {
                "bytes_sent": random.randint(500, 50_000),
                "bytes_received": random.randint(1_000, 500_000),
                "duration_ms": random.randint(50, 2000),
            },
        }
    )
    return ev


def process_start() -> dict[str, Any]:
    user = random.choice(_USERS)
    host = random.choice(_WORKSTATIONS)
    process = random.choice(_COMMON_PROCESSES)
    ev = _event_base("endpoint", "process.start", "low")
    ev.update(
        {
            "category": "process",
            "username": user,
            "hostname": host,
            "process_name": process,
            "action": "start",
            "status": "success",
            "message": f"Process started: {process}",
            "metadata": {
                "pid": random.randint(1000, 60000),
                "parent_process": random.choice(
                    ["explorer.exe", "services.exe", "svchost.exe"]
                ),
                "command_line": f"{process} --normal-arg",
            },
        }
    )
    return ev


def dns_query() -> dict[str, Any]:
    host = random.choice(_WORKSTATIONS)
    domain = random.choice(_COMMON_DOMAINS)
    ev = _event_base("dns", "dns.query", "low")
    ev.update(
        {
            "category": "dns",
            "hostname": host,
            "source_ip": _internal_ip(),
            "action": "query",
            "status": "success",
            "message": f"DNS query resolved: {domain}",
            "metadata": {
                "query_name": domain,
                "query_type": random.choice(["A", "AAAA", "CNAME", "MX"]),
                "response_code": "NOERROR",
                "resolved_ip": _internal_ip()
                if domain.endswith(".local")
                else random.choice(_EXTERNAL_IPS),
            },
        }
    )
    return ev


def system_health() -> dict[str, Any]:
    host = random.choice(_SERVERS + _WORKSTATIONS)
    ev = _event_base("system-monitor", "system.health", "low")
    ev.update(
        {
            "category": "system",
            "hostname": host,
            "action": "heartbeat",
            "status": "healthy",
            "message": f"System health check: {host}",
            "metadata": {
                "cpu_percent": round(random.uniform(5.0, 45.0), 1),
                "memory_percent": round(random.uniform(20.0, 70.0), 1),
                "disk_percent": round(random.uniform(10.0, 60.0), 1),
                "uptime_seconds": random.randint(3600, 864_000),
            },
        }
    )
    return ev


# ---------------------------------------------------------------------------
# Public scenario interface
# ---------------------------------------------------------------------------

_GENERATORS = [
    (auth_success,       0.20),
    (file_access,        0.15),
    (network_connection, 0.30),
    (process_start,      0.20),
    (dns_query,          0.10),
    (system_health,      0.05),
]

_FUNCS = [g[0] for g in _GENERATORS]
_WEIGHTS = [g[1] for g in _GENERATORS]


def generate_event() -> dict[str, Any]:
    """Return one randomly selected normal-baseline event."""
    gen = random.choices(_FUNCS, weights=_WEIGHTS, k=1)[0]
    return gen()


def generate_batch(size: int = 50) -> list[dict[str, Any]]:
    """Return a list of *size* normal-baseline events (max 1000)."""
    size = min(size, 1000)
    return [generate_event() for _ in range(size)]