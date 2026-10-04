"""
Asset management API.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_role
from app.models.asset import Asset
from app.models.user import UserRole
from app.schemas.asset import AssetCreate, AssetRead
from app.services.asset_service import create_asset, get_asset, list_assets

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetRead])
async def get_assets(current_user: CurrentUser, db: AsyncSession = Depends(get_db)) -> list[Asset]:
    return await list_assets(db)


@router.post("", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
async def add_asset(
    payload: AssetCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_role(UserRole.ADMIN, UserRole.ANALYST)),
) -> Asset:
    return await create_asset(db, payload)


@router.get("/{asset_id}", response_model=AssetRead)
async def get_asset_detail(
    asset_id: int, current_user: CurrentUser, db: AsyncSession = Depends(get_db)
) -> Asset:
    asset = await get_asset(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    return asset