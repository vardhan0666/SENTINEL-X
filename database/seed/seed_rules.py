"""
SENTINEL-X — Rule Seed Script
==============================
Seeds the database `rules` table directly from the authoritative
detection-rule registry in `app.detection.rule_registry`.

The detection rule classes are the single source of truth for:
    - rule_key
    - category
    - name
    - description
    - default_severity
    - default_threshold_config

This keeps the database configuration synchronized with the rule engine.

Idempotent:
    - Existing rules are matched by `rule_key`.
    - Existing rules are skipped so analyst runtime changes are preserved.

Usage (container):
    python /app/database/seed/seed_rules.py

Usage (host, stack running):
    docker compose exec backend python /app/database/seed/seed_rules.py
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.detection.rule_registry import ALL_RULES
from app.models.rule import Rule


async def seed_rules() -> None:
    created = 0
    skipped = 0

    print("=" * 72)
    print("SENTINEL-X — Rule Seed")
    print("=" * 72)
    print(f"Authoritative rules in registry: {len(ALL_RULES)}")
    print()

    async with AsyncSessionLocal() as session:
        try:
            for rule in ALL_RULES:
                result = await session.execute(
                    select(Rule).where(Rule.rule_key == rule.rule_key)
                )
                existing = result.scalar_one_or_none()

                if existing is not None:
                    print(
                        f"  SKIP    {rule.rule_key:<32} "
                        f"(already exists)"
                    )
                    skipped += 1
                    continue

                db_rule = Rule(
                    rule_key=rule.rule_key,
                    name=rule.name,
                    category=rule.category,
                    description=rule.description,
                    enabled=True,
                    default_severity=rule.default_severity,
                    threshold_config=dict(rule.default_threshold_config),
                )

                session.add(db_rule)

                print(
                    f"  CREATE  {rule.rule_key:<32} "
                    f"category={rule.category:<15} "
                    f"severity={rule.default_severity}"
                )
                created += 1

            await session.commit()

        except Exception as exc:
            await session.rollback()
            print()
            print(f"  ERROR: {exc}")
            print("  Transaction rolled back.")
            raise

    print()
    print("-" * 72)
    print(f"  Done — created: {created}, skipped: {skipped}")
    print(f"  Registry rules: {len(ALL_RULES)}")
    print("=" * 72)


if __name__ == "__main__":
    asyncio.run(seed_rules())