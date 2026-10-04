# SENTINEL-X Architecture

SENTINEL-X is a defensive security-monitoring platform composed of a FastAPI
backend, PostgreSQL persistence, a React/TypeScript frontend, an ML anomaly
detection layer, and a separate synthetic telemetry simulator.

## High-level flow

```text
Synthetic telemetry / source data
            |
            v
     Ingestion API
            |
            v
 Normalization + validation
            |
            v
      PostgreSQL Event
            |
            v
 Background security pipeline
   |       |       |       |
   v       v       v       v
 Rules     ML  Correlation  Risk
   \       |       |       /
    \      |       |      /
          Detection
              |
              v
          Incidents
              |
              v
       REST + WebSocket API
              |
              v
       React SOC dashboard
```

## Backend layers

`app/api/` exposes HTTP/WebSocket routes.

`app/schemas/` defines Pydantic request/response contracts.

`app/models/` defines SQLAlchemy persistence models.

`app/ingestion/` validates, normalizes, enriches, and persists telemetry.

`app/detection/` contains the rule engine and detection rules.

`app/correlation/` connects related detections/events into higher-level
security patterns.

`app/risk/` calculates risk scores and supporting factors.

`app/ml/` extracts features, maintains baseline statistics, and evaluates
anomaly models including Isolation Forest.

`app/services/` coordinates pipeline, incident, response, analytics, audit,
asset, and indicator behavior.

## Data path

An accepted event is persisted before the HTTP response completes. The event
API then schedules the full processing pipeline as a background task. The
pipeline retrieves the persisted event, evaluates rule detections, evaluates
ML anomalies for supported identities, performs correlation, and evaluates
incident creation/update.

## Real-time behavior

The backend keeps a process-local WebSocket connection manager. This is
appropriate for the current single-process deployment. A multi-instance
future design would require shared pub/sub coordination.

## Container topology

Docker Compose defines PostgreSQL, backend, frontend, and a simulator service.
The simulator is attached to a `simulation` profile so it can be started
separately from the normal application stack.
