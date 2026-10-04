# SENTINEL-X API

## Base path

The API is mounted under `/api/v1`.

## Authentication

Authentication uses bearer JWT access tokens. Login accepts
`application/x-www-form-urlencoded` credentials through FastAPI's OAuth2
password form. The token response contains `access_token`, `refresh_token`,
and `token_type`.

Protected endpoints use the authenticated-user dependency and selected routes
add role enforcement.

## Event ingestion

### POST `/api/v1/events`

Accepts one canonical event. Required framing fields are:

- `event_id`
- `timestamp`
- `source`
- `event_type`
- `severity`

Severity values are `low`, `medium`, `high`, or `critical`.

Successful persistence schedules the background detection pipeline for the
accepted event.

### POST `/api/v1/events/batch`

Accepts `{ "events": [...] }` with one to 1000 canonical events. The response
reports accepted/rejected counts, errors, and accepted event IDs.

### POST `/api/v1/events/raw/{source}`

Accepts raw source-specific telemetry and routes it through the registered
normalizer for that source.

### GET `/api/v1/events`

Lists authenticated events using the API's pagination contract.

### GET `/api/v1/events/{event_id}`

Returns an authenticated event by external event ID.

## Authentication routes

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

## Detection, incidents, analytics and supporting resources

The application also exposes routers for detections, alerts, rules, machine
learning/anomaly operations, incidents, audit logs, assets, indicators,
analytics, health, and WebSockets. Frontend services should use the actual
route definitions in `backend/app/api/` rather than hard-coding assumed paths.

## WebSockets

The backend provides a WebSocket router for live updates. The connection
manager is process-local and intended for the current single-process
architecture.

## Simulation status

The repository contains `backend/app/api/simulation.py`, which exposes read-only
simulator configuration/status endpoints. These endpoints are only live when
the simulation router is included by `backend/app/api/router.py`. Container
lifecycle remains an operational Docker Compose concern.
