"""
Sentinel-X — Event API Tests
================================
Tests for:
  POST /api/v1/events
  POST /api/v1/events/batch
  GET  /api/v1/events
  GET  /api/v1/events/{event_id}

Covers:
  - Successful single event ingestion (ADMIN + ANALYST)
  - Successful batch ingestion
  - Authentication requirements (unauthenticated → 401)
  - Authorization requirements (VIEWER → 403)
  - Duplicate event_id rejection
  - Invalid/missing required fields
  - Batch size limits
  - Event retrieval
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import make_event_payload

pytestmark = pytest.mark.asyncio


# ===========================================================================
# POST /api/v1/events — Single event ingestion
# ===========================================================================


class TestSingleEventIngestion:

    async def test_admin_can_ingest_event(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload(severity="low")
        response = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert response.status_code in (200, 201), response.text
        data = response.json()
        assert data["event_id"] == payload["event_id"]

    async def test_analyst_can_ingest_event(
        self, client: AsyncClient, analyst_auth_headers: dict
    ):
        payload = make_event_payload(severity="medium")
        response = await client.post(
            "/api/v1/events", json=payload, headers=analyst_auth_headers
        )
        assert response.status_code in (200, 201), response.text
        data = response.json()
        assert data["event_id"] == payload["event_id"]

    async def test_viewer_cannot_ingest_event(
        self, client: AsyncClient, viewer_auth_headers: dict
    ):
        payload = make_event_payload()
        response = await client.post(
            "/api/v1/events", json=payload, headers=viewer_auth_headers
        )
        assert response.status_code == 403

    async def test_unauthenticated_cannot_ingest_event(
        self, client: AsyncClient
    ):
        payload = make_event_payload()
        response = await client.post("/api/v1/events", json=payload)
        assert response.status_code == 401

    async def test_ingest_returns_persisted_event_id(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        eid = str(uuid.uuid4())
        payload = make_event_payload(event_id=eid)
        response = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert response.status_code in (200, 201)
        assert response.json()["event_id"] == eid

    async def test_ingest_all_severity_levels(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        for severity in ("low", "medium", "high", "critical"):
            payload = make_event_payload(severity=severity)
            response = await client.post(
                "/api/v1/events", json=payload, headers=admin_auth_headers
            )
            assert response.status_code in (200, 201), (
                f"Failed for severity={severity}: {response.text}"
            )

    async def test_ingest_with_optional_fields(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload(
            event_type="network.connection",
            severity="medium",
            category="network",
            source_ip="10.0.1.5",
            destination_ip="10.0.1.10",
            source_port=54321,
            destination_port=443,
            protocol="TCP",
            username="alice.johnson",
            hostname="ws-001.corp.local",
            action="connect",
            status="allowed",
            message="Test connection event",
            metadata={"bytes_sent": 1024},
        )
        response = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert response.status_code in (200, 201), response.text

    async def test_duplicate_event_id_rejected(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload()
        # First ingestion
        r1 = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert r1.status_code in (200, 201)
        # Duplicate
        r2 = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        # Backend should reject the duplicate — 409 Conflict or 400
        assert r2.status_code in (400, 409), (
            f"Expected 400/409 for duplicate, got {r2.status_code}: {r2.text}"
        )

    async def test_missing_required_field_event_id(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload()
        del payload["event_id"]
        response = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert response.status_code == 422

    async def test_missing_required_field_source(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload()
        del payload["source"]
        response = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert response.status_code == 422

    async def test_missing_required_field_event_type(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload()
        del payload["event_type"]
        response = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert response.status_code == 422

    async def test_missing_required_field_severity(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload()
        del payload["severity"]
        response = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert response.status_code == 422

    async def test_invalid_severity_rejected(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload(severity="extreme")
        response = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert response.status_code == 422

    async def test_empty_source_rejected(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload(source="")
        response = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert response.status_code == 422

    async def test_empty_event_type_rejected(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload(event_type="")
        response = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert response.status_code == 422

    async def test_invalid_timestamp_rejected(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload(timestamp="not-a-timestamp")
        response = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert response.status_code == 422


# ===========================================================================
# POST /api/v1/events/batch — Batch ingestion
# ===========================================================================


class TestBatchEventIngestion:

    async def test_batch_ingestion_succeeds(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        events = [make_event_payload() for _ in range(5)]
        response = await client.post(
            "/api/v1/events/batch",
            json={"events": events},
            headers=admin_auth_headers,
        )
        assert response.status_code in (200, 201), response.text

    async def test_batch_ingestion_analyst(
        self, client: AsyncClient, analyst_auth_headers: dict
    ):
        events = [make_event_payload() for _ in range(3)]
        response = await client.post(
            "/api/v1/events/batch",
            json={"events": events},
            headers=analyst_auth_headers,
        )
        assert response.status_code in (200, 201), response.text

    async def test_batch_viewer_forbidden(
        self, client: AsyncClient, viewer_auth_headers: dict
    ):
        events = [make_event_payload()]
        response = await client.post(
            "/api/v1/events/batch",
            json={"events": events},
            headers=viewer_auth_headers,
        )
        assert response.status_code == 403

    async def test_batch_unauthenticated_rejected(
        self, client: AsyncClient
    ):
        events = [make_event_payload()]
        response = await client.post(
            "/api/v1/events/batch", json={"events": events}
        )
        assert response.status_code == 401

    async def test_batch_empty_events_rejected(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        response = await client.post(
            "/api/v1/events/batch",
            json={"events": []},
            headers=admin_auth_headers,
        )
        # Empty batch should be rejected — 400 or 422
        assert response.status_code in (400, 422), response.text

    async def test_batch_exceeds_maximum_rejected(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        # 1001 events exceeds the 1000-event limit
        events = [make_event_payload() for _ in range(1001)]
        response = await client.post(
            "/api/v1/events/batch",
            json={"events": events},
            headers=admin_auth_headers,
        )
        assert response.status_code == 422, response.text

    async def test_batch_exactly_at_limit(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        # 1000 events is at the limit and should succeed
        events = [make_event_payload() for _ in range(1000)]
        response = await client.post(
            "/api/v1/events/batch",
            json={"events": events},
            headers=admin_auth_headers,
        )
        assert response.status_code in (200, 201), response.text

    async def test_batch_invalid_event_within_batch(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        good = make_event_payload()
        bad = make_event_payload(severity="invalid_severity")
        response = await client.post(
            "/api/v1/events/batch",
            json={"events": [good, bad]},
            headers=admin_auth_headers,
        )
        assert response.status_code == 422

    async def test_batch_missing_events_key(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        response = await client.post(
            "/api/v1/events/batch",
            json={"data": []},
            headers=admin_auth_headers,
        )
        assert response.status_code == 422


# ===========================================================================
# GET /api/v1/events — List events
# ===========================================================================


class TestGetEvents:

    async def test_get_events_authenticated(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        response = await client.get(
            "/api/v1/events", headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, (list, dict))

    async def test_get_events_analyst(
        self, client: AsyncClient, analyst_auth_headers: dict
    ):
        response = await client.get(
            "/api/v1/events", headers=analyst_auth_headers
        )
        assert response.status_code == 200

    async def test_get_events_viewer(
        self, client: AsyncClient, viewer_auth_headers: dict
    ):
        # Viewers may or may not be allowed to read events depending on
        # the existing implementation — test that the response is either
        # 200 (allowed) or 403 (forbidden), not a 5xx.
        response = await client.get(
            "/api/v1/events", headers=viewer_auth_headers
        )
        assert response.status_code in (200, 403)

    async def test_get_events_unauthenticated(
        self, client: AsyncClient
    ):
        response = await client.get("/api/v1/events")
        assert response.status_code == 401

    async def test_get_events_returns_ingested_event(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload(event_type="process.start", severity="low")
        ingest_resp = await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        assert ingest_resp.status_code in (200, 201)

        list_resp = await client.get(
            "/api/v1/events", headers=admin_auth_headers
        )
        assert list_resp.status_code == 200
        body = list_resp.json()
        # Support both list and paginated dict response shapes
        events = body if isinstance(body, list) else body.get("items", body.get("events", []))
        event_ids = [e["event_id"] for e in events]
        assert payload["event_id"] in event_ids


# ===========================================================================
# GET /api/v1/events/{event_id} — Single event retrieval
# ===========================================================================


class TestGetEventById:

    async def test_get_existing_event(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload()
        await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        response = await client.get(
            f"/api/v1/events/{payload['event_id']}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["event_id"] == payload["event_id"]
        assert data["source"] == payload["source"]
        assert data["event_type"] == payload["event_type"]
        assert data["severity"] == payload["severity"]

    async def test_get_nonexistent_event(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        response = await client.get(
            f"/api/v1/events/{uuid.uuid4()}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    async def test_get_event_unauthenticated(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        payload = make_event_payload()
        await client.post(
            "/api/v1/events", json=payload, headers=admin_auth_headers
        )
        response = await client.get(f"/api/v1/events/{payload['event_id']}")
        assert response.status_code == 401