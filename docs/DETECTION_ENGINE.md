# SENTINEL-X Detection Engine

## Processing stages

The event pipeline follows these logical stages:

1. Event persistence
2. Rule-based detection
3. ML anomaly evaluation
4. Correlation
5. Incident evaluation/update
6. Real-time notification through the application's WebSocket channel

## Rule detection

The detection package provides a common rule abstraction and a rule registry,
with rule families for authentication, network, endpoint, and DNS telemetry.

Rules consume canonical events and return detection information when a known
security pattern is present.

Examples of defensive patterns represented by the project include repeated
authentication failures, suspicious authentication sequences, anomalous
network activity, suspicious endpoint activity, and suspicious DNS activity.

## Correlation

Correlation combines related security observations so that a sequence of
individual detections can contribute to a higher-level security incident.
Correlation rules operate on the existing event/detection model rather than
requiring the simulator to implement detection logic.

## Risk

Risk scoring is a separate layer. It consumes relevant security factors and
produces a risk value used by incident and dashboard workflows.

## Incident lifecycle

The incident service evaluates detection/correlation results and either
creates a new incident or updates an existing incident according to the
current implementation.

## Design principles

- deterministic behavior for tests
- explicit severity values
- separation between detection and persistence
- defensive-only telemetry handling
- API contracts shared through Pydantic schemas
