# SENTINEL-X Testing

## Backend

The backend test suite uses pytest with asynchronous support. Tests cover the
main security pipeline layers, including:

- event validation
- normalization
- authentication
- event API behavior
- detection rules
- correlation
- risk scoring
- incident workflows
- ML anomaly behavior

## Frontend

The frontend contains component/page tests for key reusable UI behavior.
Tests should remain focused on observable rendering and interaction rather
than implementation details.

## Test philosophy

Tests should be deterministic, isolated, and independent of live external
services.

Synthetic telemetry is appropriate for exercising detection and anomaly
workflows.

## Running backend tests

Use the repository test script or execute the configured pytest command from
the backend environment.

## Migration-aware tests

Database-backed integration tests should run against the schema expected by
the current Alembic migrations. Never rewrite migrations merely to make a test
pass.

## What a successful test suite should establish

The tests should verify that authenticated requests reach the correct API
routes, canonical events are validated and normalized, security detections are
produced for representative patterns, risk/correlation/incident workflows
operate as implemented, and anomaly logic remains deterministic enough for CI.
