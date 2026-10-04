# SENTINEL-X Deployment

## Requirements

- Docker Desktop with Docker Compose
- A development `.env` file based on `.env.example`

## Main services

| Service | Role | Default port |
|---|---|---:|
| postgres | PostgreSQL database | 5432 |
| backend | FastAPI API | 8000 |
| frontend | React/Vite application | 5173 |
| simulator | Synthetic telemetry generator | internal |

The services share the `sentinelx-net` Docker network.

## Start the application

From the repository root:

```bash
docker compose up --build
```

The simulator is profile-gated and is not part of the default startup unless
the `simulation` profile is enabled.

## Start the simulator

```bash
docker compose --profile simulation up --build simulator
```

The simulator authenticates to the backend and submits synthetic telemetry
through the event ingestion API.

## Database migrations

Run Alembic through the backend container using the repository migration
script. Migrations are the authoritative schema-change mechanism.

## ML artifacts

The backend uses `/app/ml_artifacts` for model artifacts and Docker Compose
maps this to the named `sentinelx-ml-artifacts` volume.

## Environment

The backend receives `.env` values through Compose. PostgreSQL connection
settings, application ports, JWT settings, CORS configuration, and simulator
settings should be kept outside source code.

## Development caution

The simulator generates defensive synthetic telemetry only. It must not be
used as an offensive tool or pointed at unauthorized infrastructure.
