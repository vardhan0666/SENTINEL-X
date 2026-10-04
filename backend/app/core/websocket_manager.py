"""
WebSocket connection management and real-time broadcast hub for SENTINEL-X.

This will be consumed by:
  - app/api/ws.py (the /ws/events endpoint, added in a later batch)
  - the detection/correlation/incident pipeline, to push live updates
    ("event.created", "detection.created", "incident.created", ...)
    to connected analyst dashboards.

NOTE: This implementation broadcasts only to connections held in the memory
of a single backend process. This is sufficient for the local, single-worker
deployment described in this project's architecture. Scaling to multiple
backend workers would require a shared pub/sub layer (e.g. Redis) — this is
documented as a future improvement rather than implemented speculatively.
"""
import asyncio
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("sentinelx.websocket")


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
        logger.info(
            "WebSocket client connected. Active connections: %d",
            len(self._connections),
        )

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)
        logger.info(
            "WebSocket client disconnected. Active connections: %d",
            len(self._connections),
        )

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Send a JSON-serializable message to every connected client."""
        async with self._lock:
            connections = list(self._connections)

        stale: list[WebSocket] = []
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                stale.append(connection)

        if stale:
            async with self._lock:
                for connection in stale:
                    self._connections.discard(connection)

    @property
    def active_connection_count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()