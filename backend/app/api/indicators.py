"""
Local threat intelligence indicator API.

Per project scope, all indicators originate from local/sample data only —
no live external threat intelligence integration exists.
"""
from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_role
from app.models.indicator import Indicator, IndicatorType
from app.models.user import UserRole
from app.schemas.indicator import IndicatorCreate, IndicatorRead
from app.services.indicator_service import create_indicator, list_indicators

router = APIRouter(prefix="/indicators", tags=["indicators"])


@router.get("", response_model=list[IndicatorRead])
async def get_indicators(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    indicator_type: Optional[IndicatorType] = None,
) -> list[Indicator]:
    return await list_indicators(db, indicator_type)


@router.post("", response_model=IndicatorRead, status_code=status.HTTP_201_CREATED)
async def add_indicator(
    payload: IndicatorCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_role(UserRole.ADMIN, UserRole.ANALYST)),
) -> Indicator:
    return await create_indicator(db, payload)