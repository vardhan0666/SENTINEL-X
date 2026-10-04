"""
Audit log retrieval API (ADMIN only).
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.audit_log import AuditLog
from app.models.user import UserRole
from app.schemas.audit_log import AuditLogRead
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=PaginatedResponse[AuditLogRead])
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_role(UserRole.ADMIN)),
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PaginatedResponse[AuditLogRead]:
    filters = []
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if action:
        filters.append(AuditLog.action == action)
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)

    count_query = select(func.count()).select_from(AuditLog)
    for condition in filters:
        count_query = count_query.where(condition)
    total = (await db.execute(count_query)).scalar_one()

    query = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    for condition in filters:
        query = query.where(condition)
    logs = (await db.execute(query)).scalars().all()

    return PaginatedResponse(items=list(logs), total=total, limit=limit, offset=offset)