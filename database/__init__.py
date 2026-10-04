"""
Sentinel-X database seed package.

This package contains idempotent seed scripts for populating the
development and demonstration database with representative data.

Usage (from project root, with the stack running):

    docker compose exec backend python /app/database/seed/seed_users.py
    docker compose exec backend python /app/database/seed/seed_assets.py
    docker compose exec backend python /app/database/seed/seed_indicators.py
    docker compose exec backend python /app/database/seed/seed_rules.py

Or use the convenience script:

    scripts/start.sh   (seeds automatically on first run)
"""