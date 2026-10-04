"""
DNS Anomaly Scenario
======================
Simulates anomalous DNS telemetry as observed by a DNS server or
network sensor — DEFENSIVE TELEMETRY ONLY.

Patterns modelled:
  1. DNS tunnelling indicators (high-entropy / long subdomain queries,
     large TXT record responses)
  2. Domain Generation Algorithm (DGA) style queries (many NXDOMAIN
     responses to algorithmically-generated-looking domains)
  3. Fast-flux style resolution changes (same domain, many different IPs)
  4. Internal DNS reconnaissance (querying internal zone records rapidly)

This generates SYNTHETIC LOG RECORDS only.
No actual DNS queries are performed.

Event types:
  - dns.query            (baseline — allowed or NXDOMAIN)
  - dns.alert            (anomaly threshold crossed)

Severity: low → medium → high → critical
"""

from __future__ import annotations

import random
import string
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_INTERNAL_HOSTS = [f"ws-{i:03d}.corp.local" for i in range(1, 31)]
_INTERNAL_IPS = [f"10.0.{s}.{h}" for s in range(1, 4) for h in range(1, 50)]

_LEGIT_DOMAINS = [
    "microsoft.com",
    "windows.com",
    "office365.com",
]

# Synthetic high-entropy subdomains that LOOK like tunnel indicators
# These are safe random strings, not real tunnel payloads
_ALPHABET = string.ascii_lowercase + string.digits


def _random_high_entropy_label(length: int = 32) -> str:
    return "".join(random.choices(_ALPHABET, k=length))


def _random_dga_domain() -> str:
    """Produces a synthetic domain that looks algorithmically generated."""
    tlds = [".com", ".net", ".org", ".biz", ".info"]
    label_len = random.randint(8, 16)
    label = "".join(random.choices(_ALPHABET, k=label_len))
    return label + random.choice(tlds)


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


def _dns_tunnel_query(
    src_host: str,
    src_ip: str,
    offset: float,
    sequence: int,
) -> dict[str, Any]:
    parent_domain = random.choice(["tunnel-exfil-sim.example", "data-channel.example"])
    subdomain = _random_high_entropy_label(random.randint(28, 60))
    fqdn = f"{subdomain}.{parent_domain}.com"

    severity = "high" if sequence < 10 else "critical"
    ev = _event_base("dns", "dns.query", severity, offset)
    ev.update(
        {
            "category": "dns",
            "hostname": src_host,
            "source_ip": src_ip,
            "action": "query",
            "status": "success",
            "message": (
                f"High-entropy DNS query from {src_host}: {fqdn} "
                f"(possible DNS tunnelling, sequence #{sequence})"
            ),
            "metadata": {
                "query_name": fqdn,
                "query_type": random.choice(["TXT", "A", "AAAA", "NULL"]),
                "response_code": "NOERROR",
                "response_size_bytes": random.randint(200, 512),
                "query_length": len(fqdn),
                "entropy_score": round(random.uniform(4.0, 5.0), 2),
                "anomaly_note": "high_entropy_subdomain",
                "sequence": sequence,
            },
        }
    )
    return ev


def _dns_tunnel_alert(
    src_host: str,
    src_ip: str,
    offset: float,
    query_count: int,
) -> dict[str, Any]:
    ev = _event_base("dns", "dns.alert", "critical", offset)
    ev.update(
        {
            "category": "dns",
            "hostname": src_host,
            "source_ip": src_ip,
            "action": "alert",
            "status": "triggered",
            "message": (
                f"DNS tunnelling alert: {src_host} issued {query_count} "
                f"high-entropy queries within detection window"
            ),
            "metadata": {
                "query_count": query_count,
                "detection_window_seconds": 60,
                "anomaly_note": "dns_tunnel_suspected",
                "recommended_action": "investigate_host",
            },
        }
    )
    return ev


def _dga_query(
    src_host: str,
    src_ip: str,
    offset: float,
    sequence: int,
) -> dict[str, Any]:
    domain = _random_dga_domain()
    severity = "medium" if sequence < 5 else "high"
    ev = _event_base("dns", "dns.query", severity, offset)
    ev.update(
        {
            "category": "dns",
            "hostname": src_host,
            "source_ip": src_ip,
            "action": "query",
            "status": "failure",
            "message": (
                f"DGA-style NXDOMAIN from {src_host}: {domain} "
                f"(sequence #{sequence})"
            ),
            "metadata": {
                "query_name": domain,
                "query_type": "A",
                "response_code": "NXDOMAIN",
                "entropy_score": round(random.uniform(3.5, 4.8), 2),
                "anomaly_note": "dga_style_nxdomain",
                "sequence": sequence,
            },
        }
    )
    return ev


def _dga_alert(
    src_host: str, src_ip: str, offset: float, nxdomain_count: int
) -> dict[str, Any]:
    ev = _event_base("dns", "dns.alert", "critical", offset)
    ev.update(
        {
            "category": "dns",
            "hostname": src_host,
            "source_ip": src_ip,
            "action": "alert",
            "status": "triggered",
            "message": (
                f"DGA activity alert: {src_host} generated {nxdomain_count} "
                f"NXDOMAIN responses in 60s — possible malware beaconing"
            ),
            "metadata": {
                "nxdomain_count": nxdomain_count,
                "detection_window_seconds": 60,
                "anomaly_note": "dga_domain_generation",
                "recommended_action": "isolate_and_investigate",
            },
        }
    )
    return ev


def _fast_flux_query(
    src_host: str,
    src_ip: str,
    domain: str,
    offset: float,
    sequence: int,
) -> dict[str, Any]:
    # Each resolution returns a different IP from a large pool
    resolved_ip = (
        f"{random.randint(1,223)}.{random.randint(0,255)}"
        f".{random.randint(0,255)}.{random.randint(1,254)}"
    )
    ev = _event_base("dns", "dns.query", "high", offset)
    ev.update(
        {
            "category": "dns",
            "hostname": src_host,
            "source_ip": src_ip,
            "action": "query",
            "status": "success",
            "message": (
                f"Fast-flux indicator: {domain} resolved to {resolved_ip} "
                f"(resolution #{sequence}, short TTL)"
            ),
            "metadata": {
                "query_name": domain,
                "query_type": "A",
                "response_code": "NOERROR",
                "resolved_ip": resolved_ip,
                "ttl_seconds": random.randint(30, 300),
                "anomaly_note": "fast_flux_resolution",
                "sequence": sequence,
            },
        }
    )
    return ev


def _internal_recon_query(
    src_host: str,
    src_ip: str,
    offset: float,
    sequence: int,
) -> dict[str, Any]:
    internal_targets = [
        "dc01.corp.local",
        "fileserver01.corp.local",
        "backup-server.corp.local",
        "admin.corp.local",
        "_ldap._tcp.corp.local",
        "_kerberos._tcp.corp.local",
        "*.corp.local",
    ]
    target = random.choice(internal_targets)
    ev = _event_base("dns", "dns.query", "medium", offset)
    ev.update(
        {
            "category": "dns",
            "hostname": src_host,
            "source_ip": src_ip,
            "action": "query",
            "status": "success",
            "message": (
                f"Internal DNS reconnaissance from {src_host}: {target} "
                f"(sequence #{sequence})"
            ),
            "metadata": {
                "query_name": target,
                "query_type": random.choice(["A", "SRV", "PTR", "ANY"]),
                "response_code": "NOERROR",
                "anomaly_note": "rapid_internal_dns_recon",
                "sequence": sequence,
            },
        }
    )
    return ev


# ---------------------------------------------------------------------------
# Public scenario interface
# ---------------------------------------------------------------------------


def generate_tunnel_scenario(query_count: int = 15) -> list[dict[str, Any]]:
    """Generate DNS tunnelling indicator telemetry."""
    query_count = max(3, min(query_count, 100))
    src_host = random.choice(_INTERNAL_HOSTS)
    src_ip = random.choice(_INTERNAL_IPS)

    events: list[dict[str, Any]] = []
    offset = -90.0

    for i in range(query_count):
        events.append(_dns_tunnel_query(src_host, src_ip, offset, i + 1))
        offset += random.uniform(1.0, 5.0)

    events.append(_dns_tunnel_alert(src_host, src_ip, offset, query_count))
    events.sort(key=lambda e: e["timestamp"])
    return events


def generate_dga_scenario(query_count: int = 20) -> list[dict[str, Any]]:
    """Generate DGA-style NXDOMAIN telemetry."""
    query_count = max(3, min(query_count, 150))
    src_host = random.choice(_INTERNAL_HOSTS)
    src_ip = random.choice(_INTERNAL_IPS)

    events: list[dict[str, Any]] = []
    offset = -60.0

    for i in range(query_count):
        events.append(_dga_query(src_host, src_ip, offset, i + 1))
        offset += random.uniform(0.5, 3.0)

    events.append(_dga_alert(src_host, src_ip, offset, query_count))
    events.sort(key=lambda e: e["timestamp"])
    return events


def generate_fast_flux_scenario(resolution_count: int = 8) -> list[dict[str, Any]]:
    """Generate fast-flux DNS resolution telemetry."""
    resolution_count = max(3, min(resolution_count, 50))
    src_host = random.choice(_INTERNAL_HOSTS)
    src_ip = random.choice(_INTERNAL_IPS)
    domain = _random_dga_domain()

    events: list[dict[str, Any]] = []
    offset = -resolution_count * 120.0

    for i in range(resolution_count):
        events.append(
            _fast_flux_query(src_host, src_ip, domain, offset, i + 1)
        )
        offset += random.uniform(100.0, 140.0)

    events.sort(key=lambda e: e["timestamp"])
    return events


def generate_scenario() -> list[dict[str, Any]]:
    """Generate a randomly selected DNS anomaly scenario."""
    choice = random.choice(["tunnel", "dga", "fast_flux", "recon"])

    if choice == "tunnel":
        return generate_tunnel_scenario(random.randint(8, 20))
    elif choice == "dga":
        return generate_dga_scenario(random.randint(10, 30))
    elif choice == "fast_flux":
        return generate_fast_flux_scenario(random.randint(5, 15))
    else:
        # Internal recon sequence
        src_host = random.choice(_INTERNAL_HOSTS)
        src_ip = random.choice(_INTERNAL_IPS)
        events = []
        offset = -30.0
        for i in range(random.randint(5, 15)):
            events.append(_internal_recon_query(src_host, src_ip, offset, i + 1))
            offset += random.uniform(1.0, 4.0)
        events.sort(key=lambda e: e["timestamp"])
        return events


def generate_event() -> dict[str, Any]:
    """Return a single DNS anomaly event for mixed streams."""
    src_host = random.choice(_INTERNAL_HOSTS)
    src_ip = random.choice(_INTERNAL_IPS)
    return _dga_query(src_host, src_ip, 0.0, 1)