"""
Simulated defensive response actions.

Per project scope (Section 13), NO destructive, offensive, or real
enforcement action is ever taken. Every ResponseAction created here is
explicitly and permanently marked simulated=True, with a status value
drawn only from SIMULATED_SUCCESS / SIMULATED_FAILED, and every response
is written to the audit log.
"""
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.websocket_manager import manager
from app.models.incident import Incident
from app.models.response_action import ResponseAction, ResponseActionStatus, ResponseActionType
from app.models.user import User
from app.schemas.response_action import ResponseActionRead
from app.services.audit_service import log_action

logger = logging.getLogger("sentinelx.response")

_SIMULATED_OUTCOMES: dict[ResponseActionType, str] = {
    ResponseActionType.INVESTIGATE_SOURCE_IP: (
        "SIMULATION: source IP flagged and queued for analyst investigation. "
        "No network-level action was taken."
    ),
    ResponseActionType.REVIEW_AUTH_LOGS: (
        "SIMULATION: authentication logs for the affected account/source were "
        "marked for analyst review."
    ),
    ResponseActionType.ISOLATE_ENDPOINT: (
        "SIMULATION: endpoint isolation was recorded for demonstration purposes "
        "only. No host was actually isolated from the network."
    ),
    ResponseActionType.DISABLE_ACCOUNT: (
        "SIMULATION: account disable action was recorded for demonstration "
        "purposes only. No account was actually disabled."
    ),
    ResponseActionType.ROTATE_CREDENTIALS: (
        "SIMULATION: credential rotation was recorded for demonstration "
        "purposes only. No credentials were actually rotated."
    ),
    ResponseActionType.BLOCK_INDICATOR: (
        "SIMULATION: indicator block was recorded for demonstration purposes "
        "only. No firewall or network control was actually modified."
    ),
    ResponseActionType.INCREASE_MONITORING: (
        "SIMULATION: monitoring sensitivity for the affected entity was "
        "recorded as increased for demonstration purposes."
    ),
    ResponseActionType.COLLECT_TELEMETRY: (
        "SIMULATION: additional telemetry collection was recorded for "
        "demonstration purposes only."
    ),
}


async def simulate_response_action(
    db: AsyncSession,
    incident: Incident,
    action_type: ResponseActionType,
    performed_by: User,
    notes: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> ResponseAction:
    """
    Record a SIMULATED defensive response action against an incident.

    This never performs any real enforcement — see module docstring.
    """
    message = _SIMULATED_OUTCOMES.get(
        action_type, "SIMULATION: action recorded for demonstration purposes."
    )

    action = ResponseAction(
        incident_id=incident.id,
        action_type=action_type,
        status=ResponseActionStatus.SIMULATED_SUCCESS,
        simulated=True,
        performed_by=performed_by.id,
        details={"message": message, "notes": notes, "mode": "SIMULATION"},
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)

    logger.info(
        "Simulated response action '%s' recorded for incident %s by user %s.",
        action_type.value, incident.id, performed_by.username,
    )

    await manager.broadcast(
        {
            "type": "response_action.created",
            "data": ResponseActionRead.model_validate(action).model_dump(mode="json"),
        }
    )

    await log_action(
        db,
        user_id=performed_by.id,
        action="response_action.simulated",
        resource_type="incident",
        resource_id=incident.id,
        details={"action_type": action_type.value, "notes": notes},
        ip_address=ip_address,
    )

    return action