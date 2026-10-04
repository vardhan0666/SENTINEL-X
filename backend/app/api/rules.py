"""
Detection rule configuration API.

GET routes are available to any authenticated user (including VIEWER), so
analysts can see what detection logic is active. PATCH is ADMIN-only,
since changing detection thresholds/enabled state is a platform
configuration action — every change is recorded in the audit log.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_role
from app.models.rule import Rule
from app.models.user import User, UserRole
from app.schemas.rule import RuleRead, RuleUpdate
from app.services.audit_service import log_action

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("", response_model=list[RuleRead])
async def list_rules(current_user: CurrentUser, db: AsyncSession = Depends(get_db)) -> list[Rule]:
    result = await db.execute(select(Rule).order_by(Rule.category, Rule.rule_key))
    return list(result.scalars().all())


@router.get("/{rule_key}", response_model=RuleRead)
async def get_rule(rule_key: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)) -> Rule:
    result = await db.execute(select(Rule).where(Rule.rule_key == rule_key))
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found.")
    return rule


@router.patch("/{rule_key}", response_model=RuleRead)
async def update_rule(
    rule_key: str,
    payload: RuleUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> Rule:
    result = await db.execute(select(Rule).where(Rule.rule_key == rule_key))
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(rule, field_name, value)

    await db.commit()
    await db.refresh(rule)

    await log_action(
        db,
        user_id=current_user.id,
        action="rule.updated",
        resource_type="rule",
        resource_id=rule.rule_key,
        details=update_data,
        ip_address=request.client.host if request.client else None,
    )

    return rule