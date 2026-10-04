#!/usr/bin/env bash
# =============================================================================
# Sentinel-X — Run Database Migrations
# =============================================================================
# Applies all pending Alembic migrations against the running PostgreSQL
# instance using the existing backend container.
#
# Prerequisites:
#   - Docker Compose stack must be running (./scripts/start.sh)
#   - postgres and backend containers must be healthy
#
# Usage:
#   ./scripts/run_migrations.sh
#   ./scripts/run_migrations.sh --downgrade base    # downgrade to base
#   ./scripts/run_migrations.sh --history           # show migration history
#   ./scripts/run_migrations.sh --current           # show current revision
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

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
ACTION="upgrade"
TARGET="head"

case "${1:-}" in
  ""|--upgrade)
    ACTION="upgrade"
    TARGET="head"
    ;;
  --downgrade)
    ACTION="downgrade"
    TARGET="${2:?'--downgrade requires a revision target (e.g. base or a revision id)'}"
    ;;
  --history)
    ACTION="history"
    TARGET=""
    ;;
  --current)
    ACTION="current"
    TARGET=""
    ;;
  *)
    error "Unknown argument: ${1}"
    echo "Usage: $0 [--upgrade] [--downgrade <target>] [--history] [--current]"
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Verify backend container is running
# ---------------------------------------------------------------------------
if ! docker compose ps --services --filter status=running 2>/dev/null | grep -q '^backend$'; then
  error "The 'backend' container is not running."
  warn  "Start the stack first:  ./scripts/start.sh"
  exit 1
fi

# ---------------------------------------------------------------------------
# Run Alembic
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  Sentinel-X — Alembic Migrations${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""

case "${ACTION}" in
  upgrade)
    info "Running: alembic upgrade ${TARGET}"
    echo ""
    docker compose exec backend alembic upgrade "${TARGET}"
    echo ""
    success "Migrations applied successfully."
    ;;

  downgrade)
    warn  "Downgrading to: ${TARGET}"
    warn  "This operation is destructive in production environments."
    echo ""
    docker compose exec backend alembic downgrade "${TARGET}"
    echo ""
    success "Downgrade complete."
    ;;

  history)
    info "Migration history:"
    echo ""
    docker compose exec backend alembic history --verbose
    ;;

  current)
    info "Current revision:"
    echo ""
    docker compose exec backend alembic current
    ;;
esac

echo ""