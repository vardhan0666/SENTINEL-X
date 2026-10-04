# SENTINEL-X Project Structure

```text
SENTINEL-X/
├── backend/
│   ├── alembic/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── correlation/
│   │   ├── detection/
│   │   ├── ingestion/
│   │   │   └── normalizers/
│   │   ├── ml/
│   │   ├── models/
│   │   ├── risk/
│   │   ├── schemas/
│   │   └── services/
│   └── tests/
├── database/
│   └── seed/
├── docs/
├── frontend/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       ├── tests/
│       └── types/
├── scripts/
└── simulator/
    └── scenarios/
```

## Backend

The backend follows a layered FastAPI application structure. Models hold
persistence definitions, schemas define API contracts, services coordinate
business workflows, and API routers expose those workflows.

## Frontend

The React frontend is organized around pages, reusable components, hooks,
services, context, and TypeScript domain types.

## Simulator

The simulator is deliberately separate from backend Python imports. It sends
synthetic events through the public backend API over the Docker network.

## Database

Database seed code is kept separate from backend application modules while
sharing the project's SQLAlchemy/database configuration.

## Scripts

Shell scripts provide repeatable development operations for starting the
stack, applying migrations, resetting the development database, running the
simulator, and executing tests.
