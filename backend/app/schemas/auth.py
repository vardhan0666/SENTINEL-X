"""
Pydantic schemas for authentication flows.

NOTE: The /auth/login endpoint (Batch 4) uses FastAPI's built-in
OAuth2PasswordRequestForm (form-encoded username/password) rather than a
JSON body, so that the interactive Swagger "Authorize" button works
correctly out of the box. These schemas cover the token response and the
refresh flow, plus TokenPayload, which documents the shape of the decoded
JWT claims produced by app.core.security.create_access_token /
create_refresh_token.
"""
from typing import Optional

from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPayload(BaseModel):
    sub: str
    type: str
    role: Optional[str] = None
    exp: Optional[int] = None
    iat: Optional[int] = None