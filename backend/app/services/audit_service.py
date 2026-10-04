"""
Audit logging service.

Centralizes writes to the audit_logs table so every subsystem (auth,
incidents, rules, response actions, configuration changes) records
sensitive actions through a single, consistent interface. Additional
call sites are added as each subsystem is implemented (e.g. incident
status changes in Batch 9, rule threshold changes in Batch 6).
"""
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def log_action(
    db: AsyncSession,
    action: str,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Persist an audit log entry.

    Commits its own transaction so that audit logging never depends on
    (or interferes with) the caller's own transaction lifecycle — a
    caller that has already committed its primary change can safely call
    this afterward without holding a long-lived transaction open.
    """
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry