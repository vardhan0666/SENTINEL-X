"""
Sentinel-X — User Seed Script
================================
Creates deterministic development/demo users for all three roles:
  - ADMIN
  - ANALYST
  - VIEWER

Idempotent: existing users (matched by username) are skipped.

Passwords are hashed using the existing bcrypt implementation in
backend/app/core/security.py. Plaintext passwords are NEVER stored.

Usage (container):
    python /app/database/seed/seed_users.py

Usage (host, stack running):
    docker compose exec backend python /app/database/seed/seed_users.py
"""

from __future__ import annotations

import asyncio
import os
import sys

# ---------------------------------------------------------------------------
# Path bootstrap — allow running from inside the backend container where
# /app is the working directory and app/ is on the Python path.
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------
# Passwords follow the pattern <role>-sentinelx-dev
# These are DEVELOPMENT ONLY credentials — change before any production use.

SEED_USERS: list[dict] = [
    {
        "username": "admin",
        "email": "admin@sentinelx.local",
        "password": "admin-sentinelx-dev",
        "role": UserRole.ADMIN,
        "is_active": True,
    },
    {
        "username": "analyst",
        "email": "analyst@sentinelx.local",
        "password": "analyst-sentinelx-dev",
        "role": UserRole.ANALYST,
        "is_active": True,
    },
    {
        "username": "viewer",
        "email": "viewer@sentinelx.local",
        "password": "viewer-sentinelx-dev",
        "role": UserRole.VIEWER,
        "is_active": True,
    },
    {
        "username": "alice.johnson",
        "email": "alice.johnson@sentinelx.local",
        "password": "analyst-sentinelx-dev",
        "role": UserRole.ANALYST,
        "is_active": True,
    },
    {
        "username": "bob.smith",
        "email": "bob.smith@sentinelx.local",
        "password": "analyst-sentinelx-dev",
        "role": UserRole.ANALYST,
        "is_active": True,
    },
    {
        "username": "inactive.user",
        "email": "inactive@sentinelx.local",
        "password": "viewer-sentinelx-dev",
        "role": UserRole.VIEWER,
        "is_active": False,
    },
]


# ---------------------------------------------------------------------------
# Seed logic
# ---------------------------------------------------------------------------

async def seed_users() -> None:
    created = 0
    skipped = 0

    print("=" * 60)
    print("Sentinel-X — User Seed")
    print("=" * 60)

    async with AsyncSessionLocal() as session:
        try:
            for user_data in SEED_USERS:
                username = user_data["username"]

                # Idempotency check — look up by username.
                result = await session.execute(
                    select(User).where(User.username == username)
                )
                existing = result.scalar_one_or_none()

                if existing is not None:
                    print(
                        f"  SKIP    {username:<25} "
                        f"(already exists, role={existing.role.value})"
                    )
                    skipped += 1
                    continue

                # Hash the password — never store plaintext.
                hashed = hash_password(user_data["password"])

                user = User(
                    username=username,
                    email=user_data["email"],
                    hashed_password=hashed,
                    role=user_data["role"],
                    is_active=user_data["is_active"],
                )

                session.add(user)

                print(
                    f"  CREATE  {username:<25} "
                    f"role={user_data['role'].value:<10} "
                    f"active={user_data['is_active']}"
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
    asyncio.run(seed_users())