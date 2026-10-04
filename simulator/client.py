"""
Sentinel-X Simulator — HTTP Client

Handles authentication and event ingestion against the existing
backend API contract:

  POST /api/v1/auth/login      (form-encoded, returns access_token)
  POST /api/v1/events          (single event, Bearer token)
  POST /api/v1/events/batch    (up to 1000 events, Bearer token)

Authentication uses OAuth2PasswordRequestForm, so login is
submitted as application/x-www-form-urlencoded, NOT JSON.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Optional

import httpx
import structlog

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Retry helpers
# ---------------------------------------------------------------------------

_RETRYABLE_STATUS_CODES = {429, 502, 503, 504}

# Do not retry these status codes under any circumstances.
_NON_RETRYABLE_STATUS_CODES = {401, 403, 422}


def _is_retryable(exc: BaseException) -> bool:
    """
    Return True when the exception represents a transient failure that
    is safe to retry.

    Retryable conditions:
      - Network-level errors (connect, timeout, protocol)
      - HTTP 429 Too Many Requests
      - HTTP 502/503/504 gateway/server errors

    Non-retryable:
      - HTTP 401 Unauthorized  (handled separately via token refresh)
      - HTTP 403 Forbidden
      - HTTP 422 Unprocessable Entity (schema violation — retrying won't help)
      - All other 4xx client errors
    """
    if isinstance(exc, (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in _RETRYABLE_STATUS_CODES
    return False


def _retry_after_seconds(exc: BaseException, default: float) -> float:
    """
    Extract the Retry-After header value (seconds) from an HTTP 429 response.
    Falls back to *default* when the header is absent or unparseable.
    """
    if not isinstance(exc, httpx.HTTPStatusError):
        return default
    if exc.response.status_code != 429:
        return default
    header = exc.response.headers.get("Retry-After", "")
    if header:
        try:
            return max(0.0, float(header))
        except ValueError:
            pass
    return default


# ---------------------------------------------------------------------------
# SimulatorClient
# ---------------------------------------------------------------------------


class SimulatorClient:
    """
    Async HTTP client for the Sentinel-X backend.

    Usage::

        async with SimulatorClient(base_url, username, password) as client:
            await client.send_event(payload)
            await client.send_batch(payloads)
    """

    def __init__(
        self,
        base_url: str,
        username: str,
        password: str,
        timeout: float = 30.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._username = username
        self._password = password
        self._timeout = timeout

        self._access_token: Optional[str] = None
        self._token_acquired_at: float = 0.0
        # Conservative expiry window — re-authenticate 60 s before expiry.
        # Backend default is 30 min; we refresh after 25 min.
        self._token_ttl: float = 25 * 60

        self._http: Optional[httpx.AsyncClient] = None
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "SimulatorClient":
        self._http = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=self._timeout,
            follow_redirects=True,
        )
        await self._authenticate()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    async def _authenticate(self) -> None:
        """
        POST /api/v1/auth/login using OAuth2PasswordRequestForm
        (application/x-www-form-urlencoded).
        """
        assert self._http is not None, "Client not initialised"

        log = logger.bind(username=self._username)
        log.info("simulator.auth.login")

        response = await self._http.post(
            "/api/v1/auth/login",
            data={
                "username": self._username,
                "password": self._password,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code != 200:
            log.error(
                "simulator.auth.failed",
                status=response.status_code,
                body=response.text[:400],
            )
            response.raise_for_status()

        body = response.json()
        self._access_token = body["access_token"]
        self._token_acquired_at = time.monotonic()
        log.info("simulator.auth.ok")

    async def _ensure_token(self) -> str:
        """Return a valid access token, re-authenticating if necessary."""
        async with self._lock:
            age = time.monotonic() - self._token_acquired_at
            if self._access_token is None or age >= self._token_ttl:
                await self._authenticate()
            assert self._access_token is not None
            return self._access_token

    def _auth_headers(self, token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    # ------------------------------------------------------------------
    # Single event
    # ------------------------------------------------------------------

    async def send_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        """
        POST /api/v1/events — ingest one canonical event.

        Returns the JSON body of the response.
        Retries on transient network/server errors and HTTP 429.
        """
        return await self._post_with_retry("/api/v1/events", payload)

    # ------------------------------------------------------------------
    # Batch events
    # ------------------------------------------------------------------

    async def send_batch(
        self, payloads: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        POST /api/v1/events/batch — ingest up to 1000 events.

        The backend schema is EventBatchIngest: {"events": [...]}
        """
        if not payloads:
            return {}
        if len(payloads) > 1000:
            raise ValueError(
                f"Batch size {len(payloads)} exceeds maximum of 1000."
            )

        body = {"events": payloads}
        return await self._post_with_retry("/api/v1/events/batch", body)

    # ------------------------------------------------------------------
    # Internal retry logic
    # ------------------------------------------------------------------

    async def _post_with_retry(
        self, path: str, body: dict[str, Any]
    ) -> dict[str, Any]:
        """
        POST *body* to *path* with up to 5 attempts.

        Back-off strategy:
          - HTTP 429: honour Retry-After header when present;
                      otherwise use exponential back-off.
          - Other retryable errors: exponential back-off
                      (1 s, 2 s, 4 s, 8 s … capped at 30 s).
          - Non-retryable errors (401, 403, 422, other 4xx): raise immediately.
        """
        max_attempts = 5
        wait_base = 1.0
        wait_max = 30.0

        for attempt in range(1, max_attempts + 1):
            try:
                return await self._post_once(path, body)

            except Exception as exc:
                if not _is_retryable(exc) or attempt >= max_attempts:
                    logger.error(
                        "simulator.send.failed",
                        path=path,
                        attempt=attempt,
                        error=str(exc),
                    )
                    raise

                # Determine wait duration
                exponential = min(wait_base * (2 ** (attempt - 1)), wait_max)
                wait = _retry_after_seconds(exc, default=exponential)

                logger.warning(
                    "simulator.send.retry",
                    path=path,
                    attempt=attempt,
                    wait_seconds=round(wait, 2),
                    error=str(exc),
                )
                await asyncio.sleep(wait)

        # Unreachable — loop above always raises on final attempt.
        raise RuntimeError("Retry loop exited without result")  # pragma: no cover

    async def _post_once(
        self, path: str, body: dict[str, Any]
    ) -> dict[str, Any]:
        assert self._http is not None, "Client not initialised"

        token = await self._ensure_token()
        response = await self._http.post(
            path,
            json=body,
            headers=self._auth_headers(token),
        )

        if response.status_code == 401:
            # Token may have been invalidated server-side — force one refresh.
            logger.warning("simulator.token.expired.forcing_refresh")
            async with self._lock:
                self._access_token = None
            token = await self._ensure_token()
            response = await self._http.post(
                path,
                json=body,
                headers=self._auth_headers(token),
            )

        # Raise for any non-success status so _post_with_retry can inspect it.
        if response.status_code not in (200, 201, 202):
            logger.error(
                "simulator.http.error",
                path=path,
                status=response.status_code,
                body=response.text[:400],
            )
            response.raise_for_status()

        return response.json()