"""
Shared FastAPI dependency providers for SENTINEL-X.

Adds authentication/authorization dependencies on top of the database
session dependency introduced in Batch 1:

  - get_current_user: decodes the bearer JWT and loads the corresponding
    active User from the database.
  - require_role(*roles): dependency factory that additionally enforces
    the current user's role is one of the allowed roles, raising 403
    otherwise.
"""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")

_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    try:
        payload = decode_token(token)
    except JWTError:
        raise _CREDENTIALS_EXCEPTION

    if payload.get("type") != "access":
        raise _CREDENTIALS_EXCEPTION

    user_id = payload.get("sub")
    if not user_id:
        raise _CREDENTIALS_EXCEPTION

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise _CREDENTIALS_EXCEPTION

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*allowed_roles: UserRole):
    """
    Dependency factory enforcing that the authenticated user holds one of
    the given roles.

    Usage:
        @router.post(
            "/rules/{rule_key}",
            dependencies=[Depends(require_role(UserRole.ADMIN))],
        )
    """

    async def _check_role(current_user: CurrentUser) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "This action requires one of the following roles: "
                    f"{', '.join(role.value for role in allowed_roles)}."
                ),
            )
        return current_user

    return _check_role


__all__ = ["get_db", "get_current_user", "CurrentUser", "require_role"]