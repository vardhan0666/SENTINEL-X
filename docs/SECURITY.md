# SENTINEL-X Security

## Scope

SENTINEL-X is a defensive monitoring platform. Simulator activity is synthetic
telemetry and does not perform real exploitation, credential testing, malware
execution, or destructive network actions.

## Authentication

The backend uses OAuth2 password-form login with JWT access and refresh tokens.
The JWT access token contains a subject and token type, with the role included
for authorization decisions.

## Authorization

Authenticated requests resolve to an active user. Role checks are implemented
through the shared dependency factory. Event ingestion is restricted to
privileged analyst/admin roles, while read operations can be available to
broader authenticated roles where the API specifies that behavior.

## Passwords

Passwords are hashed with the existing bcrypt-based password context. Plaintext
passwords must not be stored in source code, database seed data, or Docker
images.

## Secrets

Use `.env` or an equivalent secret-management mechanism for development and
production configuration. Do not commit real JWT secrets or production
credentials.

## Database

The database is PostgreSQL. Use migrations for schema changes and limit reset
operations to controlled development environments.

## API hygiene

Input validation is performed through Pydantic schemas and source-specific
normalizers. Canonical event payloads restrict severity to the supported set
and enforce field limits for framing fields, ports, and messages.

## Simulator isolation

The simulator is a separate Docker service. The backend does not need Docker
socket access. The simulation API intentionally reports configuration/status
rather than pretending to control the host Docker daemon.

## Deployment

Run only the services and profiles required for the environment. Keep database
ports and other host bindings restricted appropriately outside local
laboratory use.
