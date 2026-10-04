#!/usr/bin/env bash
# =============================================================================
# Sentinel-X — Reset Development Database
# =============================================================================
#
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  WARNING — DESTRUCTIVE OPERATION — DEVELOPMENT USE ONLY                ║
# ║                                                                          ║
# ║  This script drops and recreates the sentinelx PostgreSQL database.     ║
# ║  ALL DATA WILL BE PERMANENTLY DELETED.                                   ║
# ║                                                                          ║
# ║  Do NOT run this script against a production database.                   ║
# ╚══════════════════════════════════════════════════════════════════════════╝
#
# What this script does:
#   1. Stops the backend container (to release DB connections)
#   2. Drops the sentinelx database inside the postgres container
#   3. Recreates the sentinelx database
#   4. Restarts the backend container
#   5. Applies all Alembic migrations
#   6. Re-runs all seed scripts
#
# Prerequisites:
#   - Docker Compose stack must be running (at minimum: postgres)
#
# Usage:
#   ./scripts/reset_db.sh
#   ./scripts/reset_db.sh --yes    # skip interactive confirmation
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# ---------------------------------------------------------------------------
# Database configuration — must match docker-compose.yml and backend config
# ---------------------------------------------------------------------------
DB_HOST="postgres"
DB_PORT="5432"
DB_NAME="sentinelx"
DB_USER="sentinel"
DB_PASSWORD="sentinel"
POSTGRES_SUPERUSER="postgres"

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
SKIP_CONFIRM=false
if [[ "${1:-}" == "--yes" ]]; then
  SKIP_CONFIRM=true
fi

# ---------------------------------------------------------------------------
# Safety banner and confirmation
# ---------------------------------------------------------------------------
echo ""
echo -e "${RED}${BOLD}============================================================${NC}"
echo -e "${RED}${BOLD}  WARNING — DESTRUCTIVE OPERATION${NC}"
echo -e "${RED}${BOLD}  DEVELOPMENT USE ONLY${NC}"
echo -e "${RED}${BOLD}============================================================${NC}"
echo ""
echo -e "${YELLOW}  This will permanently delete ALL data in the${NC}"
echo -e "${YELLOW}  '${DB_NAME}' database on the '${DB_HOST}' container.${NC}"
echo ""
echo -e "${YELLOW}  Actions to be performed:${NC}"
echo -e "${YELLOW}    1. Stop the backend container${NC}"
echo -e "${YELLOW}    2. DROP DATABASE ${DB_NAME}${NC}"
echo -e "${YELLOW}    3. CREATE DATABASE ${DB_NAME}${NC}"
echo -e "${YELLOW}    4. Restart the backend container${NC}"
echo -e "${YELLOW}    5. Apply all Alembic migrations${NC}"
echo -e "${YELLOW}    6. Run all seed scripts${NC}"
echo ""

if [[ "${SKIP_CONFIRM}" == "false" ]]; then
  read -r -p "  Type 'reset' to confirm, or anything else to abort: " confirmation
  echo ""
  if [[ "${confirmation}" != "reset" ]]; then
    info "Aborted — no changes made."
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Verify postgres container is running
# ---------------------------------------------------------------------------
if ! docker compose ps --services --filter status=running 2>/dev/null | grep -q '^postgres$'; then
  error "The 'postgres' container is not running."
  warn  "Start at minimum the postgres service:  docker compose up -d postgres"
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 1 — Stop backend to release DB connections
# ---------------------------------------------------------------------------
info "Step 1/6 — Stopping backend container..."
docker compose stop backend 2>/dev/null || true
success "Backend stopped."
echo ""

# ---------------------------------------------------------------------------
# Step 2 — Drop the database
# ---------------------------------------------------------------------------
info "Step 2/6 — Dropping database '${DB_NAME}'..."
docker compose exec -T postgres \
  psql -U "${POSTGRES_SUPERUSER}" \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
  --quiet

docker compose exec -T postgres \
  psql -U "${POSTGRES_SUPERUSER}" \
  -c "DROP DATABASE IF EXISTS ${DB_NAME};" \
  --quiet

success "Database '${DB_NAME}' dropped."
echo ""

# ---------------------------------------------------------------------------
# Step 3 — Recreate the database
# ---------------------------------------------------------------------------
info "Step 3/6 — Creating database '${DB_NAME}'..."
docker compose exec -T postgres \
  psql -U "${POSTGRES_SUPERUSER}" \
  -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" \
  --quiet

docker compose exec -T postgres \
  psql -U "${POSTGRES_SUPERUSER}" \
  -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" \
  --quiet

success "Database '${DB_NAME}' created."
echo ""

# ---------------------------------------------------------------------------
# Step 4 — Restart backend
# ---------------------------------------------------------------------------
info "Step 4/6 — Starting backend container..."
docker compose start backend
# Give the backend a moment to initialise
sleep 5
success "Backend started."
echo ""

# ---------------------------------------------------------------------------
# Step 5 — Apply migrations
# ---------------------------------------------------------------------------
info "Step 5/6 — Applying Alembic migrations..."
docker compose exec backend alembic upgrade head
success "Migrations applied."
echo ""

# ---------------------------------------------------------------------------
# Step 6 — Seed data
# ---------------------------------------------------------------------------
info "Step 6/6 — Running seed scripts..."
echo ""

info "  Seeding users..."
docker compose exec backend python /app/database/seed/seed_users.py
echo ""

info "  Seeding assets..."
docker compose exec backend python /app/database/seed/seed_assets.py
echo ""

info "  Seeding indicators..."
docker compose exec backend python /app/database/seed/seed_indicators.py
echo ""

info "  Seeding rules..."
docker compose exec backend python /app/database/seed/seed_rules.py
echo ""

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo -e "${GREEN}${BOLD}============================================================${NC}"
echo -e "${GREEN}${BOLD}  Database reset complete.${NC}"
echo -e "${GREEN}${BOLD}============================================================${NC}"
echo ""
success "Backend  → http://localhost:8000"
success "API Docs → http://localhost:8000/docs"
echo ""
echo -e "${BOLD}Default credentials:${NC}"
echo -e "  admin    / admin-sentinelx-dev"
echo -e "  analyst  / analyst-sentinelx-dev"
echo -e "  viewer   / viewer-sentinelx-dev"
echo ""