"""
Sentinel-X — Asset Seed Script
================================
Creates synthetic enterprise assets for development and demonstration.

Asset types seeded:
  workstation, server, domain_controller, database_server,
  application_server, network_device

All hostnames use the synthetic .corp.local domain.
All IP addresses are RFC 1918 private addresses.

Idempotent: assets matched by hostname are skipped.

Usage (container):
    python /app/database/seed/seed_assets.py

Usage (host, stack running):
    docker compose exec backend python /app/database/seed/seed_assets.py
"""

from __future__ import annotations

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.asset import Asset

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------
# Each dict must match the actual Asset model column names exactly.
# Fields: hostname, ip_address, asset_type, os, department, criticality,
#         is_active
#
# asset_type and criticality values must match whatever enum/string the
# existing Asset model accepts.  Using lowercase string values that map
# to the model's AssetType / CriticalityLevel enums (or plain strings
# if the model uses VARCHAR columns).

SEED_ASSETS: list[dict] = [
    # ── Domain Controllers ───────────────────────────────────────────────
    {
        "hostname": "dc01.corp.local",
        "ip_address": "10.0.1.10",
        "asset_type": "domain_controller",
        "os": "Windows Server 2022",
        "department": "IT Infrastructure",
        "criticality": "critical",
        "is_active": True,
    },
    {
        "hostname": "dc02.corp.local",
        "ip_address": "10.0.1.11",
        "asset_type": "domain_controller",
        "os": "Windows Server 2022",
        "department": "IT Infrastructure",
        "criticality": "critical",
        "is_active": True,
    },
    # ── File / Application Servers ───────────────────────────────────────
    {
        "hostname": "fileserver01.corp.local",
        "ip_address": "10.0.1.20",
        "asset_type": "server",
        "os": "Windows Server 2019",
        "department": "IT Infrastructure",
        "criticality": "high",
        "is_active": True,
    },
    {
        "hostname": "appserver01.corp.local",
        "ip_address": "10.0.2.10",
        "asset_type": "application_server",
        "os": "Ubuntu 22.04 LTS",
        "department": "Engineering",
        "criticality": "high",
        "is_active": True,
    },
    {
        "hostname": "appserver02.corp.local",
        "ip_address": "10.0.2.11",
        "asset_type": "application_server",
        "os": "Ubuntu 22.04 LTS",
        "department": "Engineering",
        "criticality": "high",
        "is_active": True,
    },
    # ── Database Servers ─────────────────────────────────────────────────
    {
        "hostname": "dbserver01.corp.local",
        "ip_address": "10.0.2.20",
        "asset_type": "database_server",
        "os": "Ubuntu 22.04 LTS",
        "department": "IT Infrastructure",
        "criticality": "critical",
        "is_active": True,
    },
    {
        "hostname": "dbserver02.corp.local",
        "ip_address": "10.0.2.21",
        "asset_type": "database_server",
        "os": "Windows Server 2019",
        "department": "Finance",
        "criticality": "critical",
        "is_active": True,
    },
    # ── Mail / Proxy ─────────────────────────────────────────────────────
    {
        "hostname": "mailserver.corp.local",
        "ip_address": "10.0.1.30",
        "asset_type": "server",
        "os": "Ubuntu 22.04 LTS",
        "department": "IT Infrastructure",
        "criticality": "high",
        "is_active": True,
    },
    {
        "hostname": "proxy01.corp.local",
        "ip_address": "10.0.1.40",
        "asset_type": "server",
        "os": "Ubuntu 22.04 LTS",
        "department": "IT Infrastructure",
        "criticality": "medium",
        "is_active": True,
    },
    # ── Network Devices ──────────────────────────────────────────────────
    {
        "hostname": "core-switch01.corp.local",
        "ip_address": "10.0.0.1",
        "asset_type": "network_device",
        "os": "Cisco IOS 17.x",
        "department": "IT Infrastructure",
        "criticality": "critical",
        "is_active": True,
    },
    {
        "hostname": "firewall01.corp.local",
        "ip_address": "10.0.0.2",
        "asset_type": "network_device",
        "os": "pfSense 2.7",
        "department": "IT Infrastructure",
        "criticality": "critical",
        "is_active": True,
    },
    {
        "hostname": "vpn-gateway.corp.local",
        "ip_address": "10.0.0.3",
        "asset_type": "network_device",
        "os": "OpenVPN Appliance",
        "department": "IT Infrastructure",
        "criticality": "high",
        "is_active": True,
    },
    # ── Workstations ─────────────────────────────────────────────────────
    {
        "hostname": "ws-001.corp.local",
        "ip_address": "10.0.3.1",
        "asset_type": "workstation",
        "os": "Windows 11 Enterprise",
        "department": "Finance",
        "criticality": "medium",
        "is_active": True,
    },
    {
        "hostname": "ws-002.corp.local",
        "ip_address": "10.0.3.2",
        "asset_type": "workstation",
        "os": "Windows 11 Enterprise",
        "department": "HR",
        "criticality": "medium",
        "is_active": True,
    },
    {
        "hostname": "ws-003.corp.local",
        "ip_address": "10.0.3.3",
        "asset_type": "workstation",
        "os": "Windows 11 Enterprise",
        "department": "Engineering",
        "criticality": "low",
        "is_active": True,
    },
    {
        "hostname": "ws-004.corp.local",
        "ip_address": "10.0.3.4",
        "asset_type": "workstation",
        "os": "macOS Sonoma 14",
        "department": "Engineering",
        "criticality": "low",
        "is_active": True,
    },
    {
        "hostname": "ws-005.corp.local",
        "ip_address": "10.0.3.5",
        "asset_type": "workstation",
        "os": "Windows 11 Enterprise",
        "department": "Executive",
        "criticality": "high",
        "is_active": True,
    },
    # Decommissioned — for testing inactive asset handling
    {
        "hostname": "legacy-ws-099.corp.local",
        "ip_address": "10.0.3.99",
        "asset_type": "workstation",
        "os": "Windows 7 Professional",
        "department": "IT Infrastructure",
        "criticality": "low",
        "is_active": False,
    },
]


# ---------------------------------------------------------------------------
# Seed logic
# ---------------------------------------------------------------------------


async def seed_assets() -> None:
    created = 0
    skipped = 0

    print("=" * 60)
    print("Sentinel-X — Asset Seed")
    print("=" * 60)

    async with AsyncSessionLocal() as session:
        try:
            for asset_data in SEED_ASSETS:
                hostname = asset_data["hostname"]

                result = await session.execute(
                    select(Asset).where(Asset.hostname == hostname)
                )
                existing = result.scalar_one_or_none()

                if existing is not None:
                    print(f"  SKIP    {hostname:<40} (already exists)")
                    skipped += 1
                    continue

                asset = Asset(**asset_data)
                session.add(asset)
                print(
                    f"  CREATE  {hostname:<40} "
                    f"type={asset_data['asset_type']:<20} "
                    f"crit={asset_data['criticality']}"
                )
                created += 1

            await session.commit()

        except Exception as exc:
            await session.rollback()
            print(f"\n  ERROR: {exc}")
            print("  Transaction rolled back.")
            raise

    print("-" * 60)
    print(f"  Done — created: {created}, skipped: {skipped}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed_assets())