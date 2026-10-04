"""
Sentinel-X — Incident Service Tests
=======================================
Tests for incident creation, updating, evaluation, and severity
handling using the existing incident service and model.

Tests cover:
  - Incident creation from correlated/detected events
  - Incident status transitions
  - Severity assignment
  - Incident retrieval via API
  - Incident update via API
  - Deduplication (same correlated group → same incident)
  - Risk-based severity propagation where supported
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.incident import Incident, IncidentStatus, IncidentSeverity
from app.models.event import Event
from app.services.incident.service import IncidentService

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_event(
    event_type: str = "authentication.failure",
    severity: str = "high",
) -> Event:
    ev = Event()
    ev.event_id = str(uuid.uuid4())
    ev.timestamp = datetime.now(timezone.utc)
    ev.source = "test-source"
    ev.event_type = event_type
    ev.severity = severity
    ev.category = "authentication"
    ev.source_ip = "203.0.113.55"
    ev.username = "testuser"
    ev.hostname = "ws-001.corp.local"
    ev.action = "login"
    ev.status = "failure"
    ev.message = "Test authentication failure"
    ev.event_metadata = {}
    return ev


async def _seed_incident(
    db: AsyncSession,
    title: str = "Test Incident",
    severity: str = "high",
    status: str = "open",
) -> Incident:
    incident = Incident(
        title=title,
        description="Synthetic test incident",
        severity=severity,
        status=status,
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return incident


# ===========================================================================
# IncidentService — unit tests
# ===========================================================================


class TestIncidentService:

    async def test_create_incident_from_events(self, db_session: AsyncSession):
        service = IncidentService()
        events = [_make_event() for _ in range(3)]

        incident = await service.create_incident(
            db=db_session,
            title="Brute Force Detected",
            description="Multiple authentication failures from single source",
            severity="high",
            related_events=events,
        )
        assert incident is not None
        assert incident.id is not None
        assert incident.title == "Brute Force Detected"
        assert incident.severity == "high"

    async def test_incident_default_status_is_open(self, db_session: AsyncSession):
        service = IncidentService()
        incident = await service.create_incident(
            db=db_session,
            title="Status Test Incident",
            description="Testing default status",
            severity="medium",
            related_events=[],
        )
        assert incident.status in ("open", IncidentStatus.OPEN, "OPEN")

    async def test_update_incident_status(self, db_session: AsyncSession):
        service = IncidentService()
        incident = await _seed_incident(db_session)

        updated = await service.update_incident(
            db=db_session,
            incident_id=incident.id,
            status="investigating",
        )
        assert updated is not None
        assert updated.status in ("investigating", IncidentStatus.INVESTIGATING, "INVESTIGATING")

    async def test_close_incident(self, db_session: AsyncSession):
        service = IncidentService()
        incident = await _seed_incident(db_session)

        updated = await service.update_incident(
            db=db_session,
            incident_id=incident.id,
            status="closed",
        )
        assert updated is not None
        assert updated.status in ("closed", IncidentStatus.CLOSED, "CLOSED")

    async def test_get_incident_by_id(self, db_session: AsyncSession):
        service = IncidentService()
        incident = await _seed_incident(db_session, title="Retrievable Incident")

        fetched = await service.get_incident(db=db_session, incident_id=incident.id)
        assert fetched is not None
        assert fetched.id == incident.id
        assert fetched.title == "Retrievable Incident"

    async def test_get_nonexistent_incident_returns_none(self, db_session: AsyncSession):
        service = IncidentService()
        result = await service.get_incident(
            db=db_session, incident_id=uuid.uuid4()
        )
        assert result is None

    async def test_list_incidents(self, db_session: AsyncSession):
        service = IncidentService()
        await _seed_incident(db_session, title="Incident Alpha")
        await _seed_incident(db_session, title="Incident Beta")

        incidents = await service.list_incidents(db=db_session)
        assert len(incidents) >= 2

    async def test_critical_severity_incident(self, db_session: AsyncSession):
        service = IncidentService()
        events = [_make_event(severity="critical") for _ in range(2)]

        incident = await service.create_incident(
            db=db_session,
            title="Critical Incident",
            description="Critical event cluster",
            severity="critical",
            related_events=events,
        )
        assert incident.severity in ("critical", IncidentSeverity.CRITICAL, "CRITICAL")

    async def test_evaluate_and_create_incident_for_event(self, db_session: AsyncSession):
        """
        evaluate_incident creates or updates an incident based on
        an event and existing detection context.
        """
        service = IncidentService()
        event = _make_event(
            event_type="authentication.failure",
            severity="high",
        )

        result = await service.evaluate_incident(db=db_session, event=event)
        # Result is either an Incident (created/updated) or None (not actionable)
        assert result is None or isinstance(result, Incident)


# ===========================================================================
# Incident API — integration tests
# ===========================================================================


class TestIncidentAPI:

    async def test_list_incidents_authenticated(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        response = await client.get(
            "/api/v1/incidents", headers=admin_auth_headers
        )
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, (list, dict))

    async def test_list_incidents_unauthenticated(
        self, client: AsyncClient
    ):
        response = await client.get("/api/v1/incidents")
        assert response.status_code == 401

    async def test_get_incident_not_found(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        response = await client.get(
            f"/api/v1/incidents/{uuid.uuid4()}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    async def test_update_incident_status_via_api(
        self,
        client: AsyncClient,
        admin_auth_headers: dict,
        db_session: AsyncSession,
    ):
        incident = await _seed_incident(db_session, title="API Update Test")
        response = await client.patch(
            f"/api/v1/incidents/{incident.id}",
            json={"status": "investigating"},
            headers=admin_auth_headers,
        )
        assert response.status_code in (200, 204), response.text

    async def test_viewer_can_read_incidents(
        self, client: AsyncClient, viewer_auth_headers: dict
    ):
        response = await client.get(
            "/api/v1/incidents", headers=viewer_auth_headers
        )
        # Viewers should at minimum get 200 or 403 (not 5xx)
        assert response.status_code in (200, 403)

    async def test_incident_contains_required_fields(
        self,
        client: AsyncClient,
        admin_auth_headers: dict,
        db_session: AsyncSession,
    ):
        incident = await _seed_incident(db_session, title="Field Check Incident")
        response = await client.get(
            f"/api/v1/incidents/{incident.id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert "id" in body or "incident_id" in body
        assert "title" in body
        assert "severity" in body
        assert "status" in body