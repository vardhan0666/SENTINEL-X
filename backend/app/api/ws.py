"""
WebSocket endpoint for real-time dashboard updates.

Broadcast message types include:

    event.created
    detection.created
    correlation.updated
    incident.created
    incident.updated
    response_action.created

WebSocket authentication:
    - Requires an access JWT in the `token` query parameter.
    - Validates the JWT using the same security primitives as HTTP auth.
    - Requires token type == "access".
    - Requires the corresponding User to exist and be active.
    - Rejects unauthenticated/invalid connections with WebSocket policy code
      1008.

The endpoint is broadcast-only from the client's perspective; incoming frames
are consumed only so disconnects are detected promptly.
"""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import decode_token
from app.core.websocket_manager import manager
from app.models.user import User

logger = logging.getLogger("sentinelx.ws")

router = APIRouter(tags=["websocket"])


async def _authenticate_websocket(websocket: WebSocket) -> User | None:
    """
    Authenticate a WebSocket using an access JWT supplied as:
        /ws/events?token=<jwt>

    Returns:
        Active User when authentication succeeds.
        None when authentication fails.
    """
    token = websocket.query_params.get("token")

    if not token:
        logger.warning(
            "Rejected WebSocket connection: missing access token."
        )
        return None

    try:
        payload = decode_token(token)
    except JWTError:
        logger.warning(
            "Rejected WebSocket connection: invalid or expired JWT."
        )
        return None

    if payload.get("type") != "access":
        logger.warning(
            "Rejected WebSocket connection: token is not an access token."
        )
        return None

    user_id = payload.get("sub")

    if not user_id:
        logger.warning(
            "Rejected WebSocket connection: JWT missing subject."
        )
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if user is None or not user.is_active:
            logger.warning(
                "Rejected WebSocket connection: user '%s' is missing "
                "or inactive.",
                user_id,
            )
            return None

        return user


@router.websocket("/ws/events")
async def websocket_events(websocket: WebSocket) -> None:
    """
    Authenticated real-time event stream.

    The connection is accepted only after the access token has been
    validated and the associated user is confirmed active.
    """
    user = await _authenticate_websocket(websocket)

    if user is None:
        await websocket.close(
            code=1008,
            reason="Authentication required.",
        )
        return

    await manager.connect(websocket)

    logger.info(
        "Authenticated WebSocket connected for user '%s' (%s).",
        user.username,
        user.role.value,
    )

    try:
        while True:
            # Broadcast-only endpoint. Consume incoming frames so the close
            # handshake is detected promptly.
            await websocket.receive_text()

    except WebSocketDisconnect:
        await manager.disconnect(websocket)

        logger.info(
            "WebSocket disconnected for user '%s'.",
            user.username,
        )

    except Exception:
        await manager.disconnect(websocket)

        logger.exception(
            "Unexpected WebSocket failure for user '%s'.",
            user.username,
        )