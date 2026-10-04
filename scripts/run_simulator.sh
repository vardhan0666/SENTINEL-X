#!/usr/bin/env bash
# =============================================================================
# Sentinel-X — Run Simulator
# =============================================================================
# Starts the event simulator using the existing Docker Compose
# 'simulation' profile.
#
# The simulator generates synthetic defensive telemetry and ingests it
# into the running Sentinel-X backend via the existing API.
#
# Prerequisites:
#   - Main stack must be running:  ./scripts/start.sh
#   - SIM_USERNAME and SIM_PASSWORD must be set (or provided below)
#
# Usage:
#   ./scripts/run_simulator.sh
#   ./scripts/run_simulator.sh --mode brute_force
#   ./scripts/run_simulator.sh --mode baseline --rate 5 --batch 20
#   ./scripts/run_simulator.sh --logs          # follow logs after start
#   ./scripts/run_simulator.sh --stop          # stop the simulator
#
# Environment variables (can be set before calling this script):
#   SIM_USERNAME   Simulator service account username (default: admin)
#   SIM_PASSWORD   Simulator service account password
#   SIM_MODE       Scenario mode (mixed|baseline|brute_force|
#                                 account_compromise|network_anomaly|
#                                 dns_anomaly|scenario_cycle)
#   SIM_RATE_EVENTS  Events per second (default: 2.0)
#   SIM_BATCH_SIZE   Events per batch  (default: 10)
#   SIM_DURATION_SEC Run duration in seconds (default: 0 = unlimited)
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
# Default simulator configuration
# ---------------------------------------------------------------------------
export SIM_USERNAME="${SIM_USERNAME:-admin}"
export SIM_PASSWORD="${SIM_PASSWORD:-admin-sentinelx-dev}"
export SIM_MODE="${SIM_MODE:-mixed}"
export SIM_RATE_EVENTS="${SIM_RATE_EVENTS:-2.0}"
export SIM_BATCH_SIZE="${SIM_BATCH_SIZE:-10}"
export SIM_DURATION_SEC="${SIM_DURATION_SEC:-0}"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
FOLLOW_LOGS=false
STOP_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      export SIM_MODE="${2:?'--mode requires a value'}"
      shift 2
      ;;
    --rate)
      export SIM_RATE_EVENTS="${2:?'--rate requires a value'}"
      shift 2
      ;;
    --batch)
      export SIM_BATCH_SIZE="${2:?'--batch requires a value'}"
      shift 2
      ;;
    --duration)
      export SIM_DURATION_SEC="${2:?'--duration requires a value'}"
      shift 2
      ;;
    --logs)
      FOLLOW_LOGS=true
      shift
      ;;
    --stop)
      STOP_MODE=true
      shift
      ;;
    *)
      error "Unknown argument: $1"
      echo "Usage: $0 [--mode MODE] [--rate N] [--batch N] [--duration N] [--logs] [--stop]"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Stop mode
# ---------------------------------------------------------------------------
if [[ "${STOP_MODE}" == "true" ]]; then
  info "Stopping simulator..."
  docker compose --profile simulation stop simulator 2>/dev/null || true
  docker compose --profile simulation rm -f simulator 2>/dev/null || true
  success "Simulator stopped."
  exit 0
fi

# ---------------------------------------------------------------------------
# Verify backend is running
# ---------------------------------------------------------------------------
if ! docker compose ps --services --filter status=running 2>/dev/null | grep -q '^backend$'; then
  error "The 'backend' container is not running."
  warn  "Start the main stack first:  ./scripts/start.sh"
  exit 1
fi

# ---------------------------------------------------------------------------
# Validate SIM_PASSWORD
# ---------------------------------------------------------------------------
if [[ -z "${SIM_PASSWORD}" ]]; then
  error "SIM_PASSWORD is not set."
  warn  "Export it before running:  export SIM_PASSWORD='your-password'"
  exit 1
fi

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  Sentinel-X — Event Simulator${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""
info "Mode         : ${SIM_MODE}"
info "Rate         : ${SIM_RATE_EVENTS} events/sec"
info "Batch size   : ${SIM_BATCH_SIZE}"
info "Duration     : ${SIM_DURATION_SEC}s  (0 = unlimited)"
info "Username     : ${SIM_USERNAME}"
echo ""

# ---------------------------------------------------------------------------
# Build simulator image if stale
# ---------------------------------------------------------------------------
info "Building simulator image (if stale)..."
docker compose --profile simulation build --quiet simulator
success "Simulator image ready."
echo ""

# ---------------------------------------------------------------------------
# Start simulator
# ---------------------------------------------------------------------------
info "Starting simulator (detached)..."
docker compose --profile simulation up -d simulator
echo ""
success "Simulator started."
echo ""

if [[ "${FOLLOW_LOGS}" == "true" ]]; then
  info "Following simulator logs (Ctrl+C to stop following — simulator keeps running)..."
  echo ""
  docker compose --profile simulation logs -f simulator
else
  echo -e "${BOLD}Useful commands:${NC}"
  echo -e "  docker compose --profile simulation logs -f simulator   # follow logs"
  echo -e "  docker compose --profile simulation ps                  # status"
  echo -e "  ./scripts/run_simulator.sh --stop                       # stop"
  echo ""
fi