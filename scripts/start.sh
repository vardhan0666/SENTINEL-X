#!/usr/bin/env bash
# =============================================================================
# Sentinel-X — Start Script
# =============================================================================
# Starts the main Docker Compose stack (postgres + backend + frontend).
# Does NOT start the simulator — use scripts/run_simulator.sh for that.
#
# Usage:
#   ./scripts/start.sh            # start in background (detached)
#   ./scripts/start.sh --logs     # start in background then follow logs
#   ./scripts/start.sh --fg       # start in foreground (attached)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve project root (one level above scripts/)
# ---------------------------------------------------------------------------
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
MODE="detached"
case "${1:-}" in
  --logs) MODE="logs"   ;;
  --fg)   MODE="fg"     ;;
  "")     MODE="detached" ;;
  *)
    error "Unknown argument: ${1}"
    echo "Usage: $0 [--logs|--fg]"
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
  error "docker is not installed or not on PATH."
  exit 1
fi

if ! docker compose version &>/dev/null; then
  error "docker compose (v2) is not available."
  error "Install Docker Desktop >= 3.4 or docker-compose-plugin."
  exit 1
fi

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  Sentinel-X SIEM Platform${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""
info "Project root : ${PROJECT_ROOT}"
info "Compose file : docker-compose.yml"
info "Mode         : ${MODE}"
echo ""

# ---------------------------------------------------------------------------
# Build images if necessary
# ---------------------------------------------------------------------------
info "Building images (if stale)..."
docker compose build --quiet
success "Images ready."
echo ""

# ---------------------------------------------------------------------------
# Start stack
# ---------------------------------------------------------------------------
case "${MODE}" in
  detached)
    info "Starting stack in detached mode..."
    docker compose up -d
    echo ""
    success "Stack started."
    echo ""
    echo -e "${BOLD}Services:${NC}"
    echo -e "  Backend  API  →  http://localhost:8000"
    echo -e "  Backend  Docs →  http://localhost:8000/docs"
    echo -e "  Frontend      →  http://localhost:5173"
    echo -e "  PostgreSQL    →  localhost:5432  (db=sentinelx)"
    echo ""
    echo -e "${BOLD}Useful commands:${NC}"
    echo -e "  docker compose logs -f               # follow all logs"
    echo -e "  docker compose logs -f backend       # backend logs only"
    echo -e "  docker compose ps                    # service status"
    echo -e "  ./scripts/run_migrations.sh          # apply DB migrations"
    echo -e "  ./scripts/run_simulator.sh           # start simulator"
    echo -e "  ./scripts/run_tests.sh               # run test suite"
    echo -e "  ./scripts/reset_db.sh                # reset database (destructive)"
    echo ""
    ;;

  logs)
    info "Starting stack in detached mode, then following logs..."
    docker compose up -d
    echo ""
    success "Stack started. Following logs (Ctrl+C to stop following — stack keeps running)."
    echo ""
    docker compose logs -f
    ;;

  fg)
    info "Starting stack in foreground mode (Ctrl+C to stop)..."
    echo ""
    docker compose up
    ;;
esac