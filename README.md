# SENTINEL-X

**Real-Time Cyber Threat Detection, Security Monitoring & Defensive Response Platform**

> ⚠️ Defensive cybersecurity project. Operates only on synthetic telemetry,
> sample logs, and simulated events in local/authorized lab environments.
> No offensive, destructive, or unauthorized functionality is implemented.
> See `docs/SECURITY.md` *(added in a later batch)*.

---

## What is SENTINEL-X?

SENTINEL-X is a local, SOC-style security monitoring platform that ingests
security telemetry (authentication logs, network connections, DNS activity,
endpoint events, firewall events), normalizes it into a canonical schema,
runs it through a rule-based detection engine and a statistical/ML anomaly
engine, correlates related events into incidents, calculates transparent
risk scores, and presents everything through an analyst-facing dashboard —
with full explainability at every stage.

This is **not** a hardcoded demo dashboard. Every alert, score, and incident
shown by the platform is produced by actually processing ingested events.

## Architecture (summary)

Telemetry → Ingestion → Validation → Normalization → Enrichment
→ Detection Engine (rules) + ML Anomaly Engine
→ Correlation Engine → Risk Scoring → Explainability
→ Incident Management → Defensive Response (simulated)
→ Real-time Analyst Dashboard


Full architectural detail lives in `docs/ARCHITECTURE.md` (added as the
corresponding subsystems are implemented).

## Technology Stack

| Layer | Stack |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0 (async), Alembic, PostgreSQL 15 |
| ML | scikit-learn (Isolation Forest), NumPy, pandas |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Realtime | WebSockets |
| Auth | JWT + bcrypt, role-based access control (ADMIN/ANALYST/VIEWER) |
| Infra | Docker Compose |

## Project Status

This repository is being built incrementally in reviewed batches. Current
status:

- [x] **Batch 1** — Project scaffold, Docker Compose, backend core
      (config, database, security, logging, WebSocket manager), Alembic
      scaffold, minimal health-checked FastAPI app.
- [x] **Batch 2** — Full relational schema: SQLAlchemy models for users,
      assets, events, rules, detections, anomaly results, correlation
      groups, incidents, indicators, response actions, and audit logs,
      plus the initial Alembic migration.
- [x] **Batch 3** — Pydantic schemas for every resource (request/response
      contracts for the upcoming API).
- [x] **Batch 4** — Authentication & RBAC: JWT login/refresh/me/logout,
      role-enforcement dependency, seed script for demo accounts, audit
      logging of login/logout events.
- [ ] Ingestion & normalization engine
- [ ] Detection engine (rules)
- [ ] Correlation & risk scoring
- [ ] ML anomaly engine
- [ ] Incident management & response simulation
- [ ] Analytics, health, WebSocket API
- [ ] Telemetry simulator
- [ ] Backend test suite
- [ ] Frontend application
- [ ] Full documentation set

Do not expect endpoints beyond `/`, `/api/v1/health`, and `/api/v1/auth/*`
to exist until the corresponding batch lands.

## Quick Start (current batch)

```bash
# 1. Copy environment template
cp .env.example .env
# Edit .env and set a real SECRET_KEY, e.g.:
#   openssl rand -hex 32

# 2. Start the database and backend (frontend/simulator are not yet buildable)
docker compose up --build postgres backend

# 3. Verify the API is healthy
curl http://localhost:8000/api/v1/health

# 4. Seed demo accounts (ADMIN / ANALYST / VIEWER)
docker compose exec backend python -m database.seed.seed_users

Default Credentials (local development only)
Username	Password	Role
admin	ChangeMe123!	ADMIN
analyst	ChangeMe123!	ANALYST
viewer	ChangeMe123!	VIEWER

Rotate or disable these before ever exposing SENTINEL-X beyond your local
machine.

Authentication Flow
Login (OAuth2 password flow, form-encoded body):
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=analyst&password=ChangeMe123!"

  Response:
  {
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}

Use the access token on subsequent requests:
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"

  Interactive API docs (with a working "Authorize" button): http://localhost:8000/docs

Security Scope
SENTINEL-X is strictly defensive. It does not implement malware, exploit
delivery, credential harvesting, unauthorized scanning, or any offensive
capability. All "response actions" are clearly-labeled simulations intended
for analyst training and platform demonstration. See docs/SECURITY.md
(added in a later batch) for the full scope statement.

License
MIT — see LICENSE.


---

## BATCH 3 + 4 — CONSISTENCY CHECK

- **Schema ↔ model alignment:** every Pydantic schema's `from_attributes=True` config targets fields that actually exist on the corresponding Batch 2 ORM model (verified field-by-field for `User`, `Event`, `Detection`, `Incident`, `Asset`, `Indicator`, `Rule`, `AnomalyResult`, `ResponseAction`, `AuditLog`). ✅
- **Reserved-name handling:** `EventRead.metadata` uses `validation_alias="event_metadata"` / `serialization_alias="metadata"` to correctly bridge the ORM's `event_metadata` Python attribute (required to avoid colliding with SQLAlchemy's `Base.metadata`) to a clean `metadata` key in the JSON API — verified FastAPI's default `response_model_by_alias=True` will emit `"metadata"` in responses. ✅
- **Enum reuse, not duplication:** schemas import `UserRole`, `AssetCriticality`, `DetectionType`, `IncidentStatus`, `IndicatorType`, `ResponseActionType`, `ResponseActionStatus` directly from `app.models.*` rather than redefining them — guarantees the API layer and persistence layer can never drift out of sync. ✅
- **Critical dependency gaps caught and fixed:** `python-multipart` (required by `OAuth2PasswordRequestForm`) and `email-validator` (required by `EmailStr`) were missing from Batch 1's `requirements.txt`. Both are explicitly called out and corrected in this batch per Rule 27 ("if a previous batch contains an error, explicitly identify it and provide the corrected file before continuing"). ✅
- **Auth dependency chain:** `app.api.auth` → `app.core.deps.CurrentUser` → `app.core.security.decode_token` → `app.core.config.settings` — no circular imports (`app.core.deps` does not import from `app.api.*`). ✅
- **`oauth2_scheme` tokenUrl correctness:** `f"{settings.API_V1_PREFIX}/auth/login"` resolves to `/api/v1/auth/login`, which matches the actual mounted route (`api_router` included with `prefix=settings.API_V1_PREFIX` in `main.py`, and `auth.router` declares `prefix="/auth"`). Verified this exact path is what Swagger's "Authorize" button will POST to. ✅
- **`app.main` wiring:** `main.py` now imports `app.api.router.api_router` and calls `app.include_router(api_router, prefix=settings.API_V1_PREFIX)`; the previously-existing `/` and `/api/v1/health` routes are untouched and do not conflict with the new `/api/v1/auth/*` routes. ✅
- **Seed script import path:** `database/seed/seed_users.py` imports `app.core.database`, `app.core.security`, `app.models` — these resolve correctly inside the backend container because `docker-compose.yml` now mounts `./database:/app/database` alongside the existing `./backend:/app` mount, placing both `app/` and `database/` as sibling top-level packages under the container's `/app` working directory. ✅
- **Idempotency:** `seed_users.py` checks for existing usernames before inserting, so it is safe to run multiple times (required since it will be re-invoked in demo/testing workflows in later batches). ✅
- **Audit logging correctness:** `log_action()` commits its own transaction independently of the caller's, so the login endpoint's `user.last_login_at` commit and the subsequent audit log commit cannot interfere with each other. ✅
- **No secrets or destructive logic:** login/logout only read/update non-destructive fields (`last_login_at`) and never execute any offensive/destructive action, consistent with the project's defensive scope. ✅
- **No placeholder code:** every endpoint in `app/api/auth.py` is fully functional against the real database (no mocked responses). ✅

---

Batch 3 and Batch 4 are complete and internally consistent with Batches 1–2. Waiting for your instruction: **"START BATCH 5"**.