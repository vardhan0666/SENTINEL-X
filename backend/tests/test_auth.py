"""
Sentinel-X — Authentication API Tests
========================================
Tests for:
  POST /api/v1/auth/login
  POST /api/v1/auth/refresh
  GET  /api/v1/auth/me

Covers:
  - Successful login (form-encoded OAuth2PasswordRequestForm)
  - Token structure validation
  - Access token use on protected endpoints
  - Refresh token flow
  - Invalid credentials
  - Inactive user rejection
  - /auth/me returns correct user info
  - Role information present in response/token
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, decode_token
from app.models.user import User, UserRole

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _login(client: AsyncClient, username: str, password: str) -> dict:
    """POST form-encoded login, return response JSON."""
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return response


# ===========================================================================
# Login
# ===========================================================================


class TestLogin:

    async def test_admin_login_succeeds(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await _login(client, "test_admin", "admin-password-test")
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"].lower() == "bearer"

    async def test_analyst_login_succeeds(
        self, client: AsyncClient, analyst_user: User
    ):
        resp = await _login(client, "test_analyst", "analyst-password-test")
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body

    async def test_viewer_login_succeeds(
        self, client: AsyncClient, viewer_user: User
    ):
        resp = await _login(client, "test_viewer", "viewer-password-test")
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body

    async def test_wrong_password_rejected(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await _login(client, "test_admin", "wrong-password")
        assert resp.status_code in (400, 401, 403)

    async def test_nonexistent_user_rejected(
        self, client: AsyncClient
    ):
        resp = await _login(client, "nobody@example.com", "irrelevant")
        assert resp.status_code in (400, 401, 403)

    async def test_empty_username_rejected(
        self, client: AsyncClient
    ):
        resp = await _login(client, "", "password")
        assert resp.status_code in (400, 401, 422)

    async def test_empty_password_rejected(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await _login(client, "test_admin", "")
        assert resp.status_code in (400, 401, 422)

    async def test_login_requires_form_encoding(
        self, client: AsyncClient, admin_user: User
    ):
        # Sending JSON instead of form-encoded should be rejected
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "test_admin", "password": "admin-password-test"},
        )
        assert resp.status_code == 422

    async def test_inactive_user_cannot_login(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        inactive = User(
            username="inactive_test_user",
            email="inactive_test@sentinelx.test",
            hashed_password=get_password_hash("password123"),
            role=UserRole.VIEWER,
            is_active=False,
        )
        db_session.add(inactive)
        await db_session.commit()

        resp = await _login(client, "inactive_test_user", "password123")
        # Backend should reject inactive users — 400 or 403
        assert resp.status_code in (400, 401, 403)


# ===========================================================================
# Token structure
# ===========================================================================


class TestTokenStructure:

    async def test_access_token_contains_sub(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await _login(client, "test_admin", "admin-password-test")
        token = resp.json()["access_token"]
        payload = decode_token(token)
        assert payload is not None
        assert payload.get("sub") == "test_admin"

    async def test_access_token_type_field(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await _login(client, "test_admin", "admin-password-test")
        token = resp.json()["access_token"]
        payload = decode_token(token)
        assert payload.get("type") == "access"

    async def test_access_token_contains_role(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await _login(client, "test_admin", "admin-password-test")
        token = resp.json()["access_token"]
        payload = decode_token(token)
        assert "role" in payload
        assert payload["role"] == UserRole.ADMIN.value

    async def test_refresh_token_type_field(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await _login(client, "test_admin", "admin-password-test")
        refresh_token = resp.json()["refresh_token"]
        payload = decode_token(refresh_token)
        assert payload is not None
        assert payload.get("type") == "refresh"

    async def test_access_token_contains_exp(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await _login(client, "test_admin", "admin-password-test")
        token = resp.json()["access_token"]
        payload = decode_token(token)
        assert "exp" in payload

    async def test_access_token_contains_iat(
        self, client: AsyncClient, admin_user: User
    ):
        resp = await _login(client, "test_admin", "admin-password-test")
        token = resp.json()["access_token"]
        payload = decode_token(token)
        assert "iat" in payload


# ===========================================================================
# Using access token on protected endpoints
# ===========================================================================


class TestAccessTokenUsage:

    async def test_access_token_authorises_event_ingestion(
        self, client: AsyncClient, admin_user: User
    ):
        from tests.conftest import make_event_payload

        resp = await _login(client, "test_admin", "admin-password-test")
        token = resp.json()["access_token"]

        payload = make_event_payload()
        event_resp = await client.post(
            "/api/v1/events",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert event_resp.status_code in (200, 201)

    async def test_invalid_token_rejected(
        self, client: AsyncClient
    ):
        response = await client.get(
            "/api/v1/events",
            headers={"Authorization": "Bearer this.is.not.valid"},
        )
        assert response.status_code == 401

    async def test_missing_bearer_rejected(
        self, client: AsyncClient
    ):
        response = await client.get(
            "/api/v1/events",
            headers={"Authorization": "Basic dXNlcjpwYXNz"},
        )
        assert response.status_code == 401

    async def test_no_auth_header_rejected(
        self, client: AsyncClient
    ):
        response = await client.get("/api/v1/events")
        assert response.status_code == 401


# ===========================================================================
# Token refresh
# ===========================================================================


class TestTokenRefresh:

    async def test_refresh_token_returns_new_access_token(
        self, client: AsyncClient, admin_user: User
    ):
        login_resp = await _login(client, "test_admin", "admin-password-test")
        refresh_token = login_resp.json()["refresh_token"]

        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refresh_resp.status_code == 200
        body = refresh_resp.json()
        assert "access_token" in body

    async def test_refresh_with_invalid_token_rejected(
        self, client: AsyncClient
    ):
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "not.a.valid.token"},
        )
        assert resp.status_code in (400, 401, 422)

    async def test_refresh_with_access_token_rejected(
        self, client: AsyncClient, admin_user: User
    ):
        # Using an access token as a refresh token should be rejected
        login_resp = await _login(client, "test_admin", "admin-password-test")
        access_token = login_resp.json()["access_token"]

        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": access_token},
        )
        assert resp.status_code in (400, 401, 422)

    async def test_refresh_missing_body_rejected(
        self, client: AsyncClient
    ):
        resp = await client.post("/api/v1/auth/refresh", json={})
        assert resp.status_code == 422


# ===========================================================================
# GET /api/v1/auth/me
# ===========================================================================


class TestAuthMe:

    async def test_me_returns_current_user(
        self, client: AsyncClient, admin_user: User
    ):
        login_resp = await _login(client, "test_admin", "admin-password-test")
        token = login_resp.json()["access_token"]

        me_resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        body = me_resp.json()
        assert body["username"] == "test_admin"

    async def test_me_returns_role(
        self, client: AsyncClient, admin_user: User
    ):
        login_resp = await _login(client, "test_admin", "admin-password-test")
        token = login_resp.json()["access_token"]

        me_resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        body = me_resp.json()
        assert "role" in body
        assert body["role"] == UserRole.ADMIN.value

    async def test_me_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    async def test_analyst_me(
        self, client: AsyncClient, analyst_user: User
    ):
        login_resp = await _login(client, "test_analyst", "analyst-password-test")
        token = login_resp.json()["access_token"]

        me_resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        body = me_resp.json()
        assert body["username"] == "test_analyst"
        assert body["role"] == UserRole.ANALYST.value