#!/bin/sh
set -e

echo "[entrypoint] Waiting for database to become reachable..."
python - <<'PYEOF'
import asyncio
import sys

from app.core.database import check_database_connection


async def wait_for_db() -> None:
    for attempt in range(1, 31):
        if await check_database_connection():
            print("[entrypoint] Database is ready.")
            return
        print(f"[entrypoint] Database not ready yet (attempt {attempt}/30). Retrying in 2s...")
        await asyncio.sleep(2)
    print("[entrypoint] Database was not reachable after 30 attempts.")
    sys.exit(1)


asyncio.run(wait_for_db())
PYEOF

echo "[entrypoint] Running database migrations..."
alembic upgrade head

echo "[entrypoint] Starting SENTINEL-X backend..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000