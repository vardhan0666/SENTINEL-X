"""
Sentinel-X — Threat Intelligence Indicator Seed
================================================

Creates synthetic defensive threat-intelligence indicators
for local development and demonstration.

IMPORTANT:
All indicators are synthetic/documentation-safe values.

Supported indicator types:
    IP
    DOMAIN
    HASH
    URL

The seed data matches the current Indicator SQLAlchemy model.

Idempotency:
    Existing indicators are detected using (type, value)
    and skipped instead of duplicated.

Usage:
    python database/seed/seed_indicators.py

Container:
    docker compose exec backend python /app/database/seed/seed_indicators.py
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import and_, select

# Allow imports from the project root.
PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.core.database import AsyncSessionLocal
from app.models.indicator import Indicator, IndicatorType


SEED_INDICATORS: list[dict] = [
    # ------------------------------------------------------------------
    # IP indicators
    # ------------------------------------------------------------------
    {
        "type": IndicatorType.IP,
        "value": "192.0.2.100",
        "risk_level": "high",
        "description": (
            "Synthetic C2 infrastructure indicator for demonstration."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.IP,
        "value": "192.0.2.200",
        "risk_level": "critical",
        "description": (
            "Synthetic botnet infrastructure indicator for demonstration."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.IP,
        "value": "198.51.100.50",
        "risk_level": "high",
        "description": (
            "Synthetic brute-force source indicator for demonstration."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.IP,
        "value": "198.51.100.99",
        "risk_level": "medium",
        "description": (
            "Synthetic port-scanner indicator for demonstration."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.IP,
        "value": "203.0.113.55",
        "risk_level": "high",
        "description": (
            "Synthetic credential-stuffing source indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.IP,
        "value": "203.0.113.200",
        "risk_level": "critical",
        "description": (
            "Synthetic data-exfiltration staging indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.IP,
        "value": "203.0.113.33",
        "risk_level": "medium",
        "description": (
            "Synthetic suspicious-scanning indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.IP,
        "value": "192.0.2.14",
        "risk_level": "low",
        "description": (
            "Synthetic low-risk watchlist indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.IP,
        "value": "192.0.2.250",
        "risk_level": "low",
        "description": (
            "Synthetic retired indicator retained for demonstration."
        ),
        "source": "local-sample-feed",
    },

    # ------------------------------------------------------------------
    # DOMAIN indicators
    # ------------------------------------------------------------------
    {
        "type": IndicatorType.DOMAIN,
        "value": "malware-c2.example",
        "risk_level": "critical",
        "description": (
            "Synthetic C2 domain indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.DOMAIN,
        "value": "phishing-kit.example",
        "risk_level": "high",
        "description": (
            "Synthetic phishing campaign domain indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.DOMAIN,
        "value": "dga-beacon.test",
        "risk_level": "high",
        "description": (
            "Synthetic DGA-style beacon domain indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.DOMAIN,
        "value": "dns-tunnel-exfil.example",
        "risk_level": "critical",
        "description": (
            "Synthetic DNS tunnelling indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.DOMAIN,
        "value": "suspicious-redirect.invalid",
        "risk_level": "medium",
        "description": (
            "Synthetic suspicious redirect-domain indicator."
        ),
        "source": "local-sample-feed",
    },

    # ------------------------------------------------------------------
    # HASH indicators
    # Synthetic values only; they do not represent real malware files.
    # ------------------------------------------------------------------
    {
        "type": IndicatorType.HASH,
        "value": (
            "a3f1c2e4b5d6789012345678901234567890"
            "abcdef1234567890abcdef123456"
        ),
        "risk_level": "critical",
        "description": (
            "Synthetic ransomware-dropper hash indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.HASH,
        "value": (
            "b2e3d4f5a6c7890123456789012345678901"
            "bcdef2345678901bcdef2345678"
        ),
        "risk_level": "high",
        "description": (
            "Synthetic keylogger-payload hash indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.HASH,
        "value": (
            "c1d2e3f4a5b6789012345678901234567890"
            "cdef3456789012cdef34567890ab"
        ),
        "risk_level": "high",
        "description": (
            "Synthetic backdoor-installer hash indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.HASH,
        "value": (
            "d0e1f2a3b4c5678901234567890123456789"
            "def4567890123def456789012bcd"
        ),
        "risk_level": "medium",
        "description": (
            "Synthetic suspicious-script hash indicator."
        ),
        "source": "local-sample-feed",
    },

    # ------------------------------------------------------------------
    # URL indicators
    # ------------------------------------------------------------------
    {
        "type": IndicatorType.URL,
        "value": "https://malware-c2.example/dropper",
        "risk_level": "critical",
        "description": (
            "Synthetic malware-delivery URL indicator."
        ),
        "source": "local-sample-feed",
    },
    {
        "type": IndicatorType.URL,
        "value": "https://phishing-kit.example/login",
        "risk_level": "high",
        "description": (
            "Synthetic phishing landing-page URL indicator."
        ),
        "source": "local-sample-feed",
    },
]


async def seed_indicators() -> None:
    created = 0
    skipped = 0

    print("=" * 72)
    print("SENTINEL-X — Threat Intelligence Indicator Seed")
    print("=" * 72)

    async with AsyncSessionLocal() as session:
        try:
            for indicator_data in SEED_INDICATORS:
                indicator_type = indicator_data["type"]
                indicator_value = indicator_data["value"]

                result = await session.execute(
                    select(Indicator).where(
                        and_(
                            Indicator.type == indicator_type,
                            Indicator.value == indicator_value,
                        )
                    )
                )

                existing = result.scalar_one_or_none()

                if existing is not None:
                    print(
                        "  SKIP    "
                        f"[{indicator_type.value:<6}] "
                        f"{indicator_value:<55}"
                    )
                    skipped += 1
                    continue

                indicator = Indicator(**indicator_data)

                session.add(indicator)

                print(
                    "  CREATE  "
                    f"[{indicator_type.value:<6}] "
                    f"{indicator_value:<55} "
                    f"risk={indicator_data['risk_level']}"
                )

                created += 1

            await session.commit()

        except Exception as exc:
            await session.rollback()

            print()
            print(f"ERROR: {exc}")
            print("Transaction rolled back.")

            raise

    print("-" * 72)
    print(
        f"Done — created: {created}, skipped: {skipped}"
    )
    print("=" * 72)


if __name__ == "__main__":
    asyncio.run(seed_indicators())