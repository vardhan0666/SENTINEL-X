#!/usr/bin/env bash
# =============================================================================
# Sentinel-X — Run Test Suite
# =============================================================================
# Runs the existing backend pytest test suite using the project's
# pytest.ini configuration inside the backend container.
#
# Prerequisites:
#   - Docker Compose stack must be running (./scripts/start.sh)
#   - postgres and backend containers must be healthy
#
# Usage:
#   ./scripts/run_tests.sh                          # run all tests
#   ./scripts/run_tests.sh tests/test_events.py     # run specific file
#   ./scripts/run_tests.sh -k test_auth             # run by keyword
#   ./scripts/run_tests.sh -v                       # verbose output
#   ./scripts/run_tests.sh --cov                    # with coverage report
#   ./scripts/run_tests.sh --no-docker              # run on host (if env set)
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
NO_DOCKER=false
PYTEST_ARGS=()
COVERAGE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-docker)
      NO_DOCKER=true
      shift
      ;;
    --cov)
      COVERAGE=true
      shift
      ;;
    *)
      # Pass all other arguments directly to pytest
      PYTEST_ARGS+=("$1")
      shift
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  Sentinel-X — Backend Test Suite${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""

# ---------------------------------------------------------------------------
# Build pytest command
# ---------------------------------------------------------------------------
PYTEST_CMD="pytest"

if [[ "${COVERAGE}" == "true" ]]; then
  PYTEST_CMD="pytest --cov=app --cov-report=term-missing --cov-report=html:/app/htmlcov"
  info "Coverage report will be written to backend/htmlcov/index.html"
  echo ""
fi

# Append any extra args passed to this script
if [[ ${#PYTEST_ARGS[@]} -gt 0 ]]; then
  PYTEST_CMD="${PYTEST_CMD} ${PYTEST_ARGS[*]}"
fi

# ---------------------------------------------------------------------------
# Run tests
# ---------------------------------------------------------------------------
if [[ "${NO_DOCKER}" == "true" ]]; then
  # Run on host — assumes the caller has set DATABASE_URL etc.
  warn "--no-docker mode: running pytest on the host directly."
  warn "Ensure all environment variables and dependencies are set."
  echo ""
  cd "${PROJECT_ROOT}/backend"
  eval "${PYTEST_CMD}"
else
  # Run inside the backend container
  if ! docker compose ps --services --filter status=running 2>/dev/null | grep -q '^backend$'; then
    error "The 'backend' container is not running."
    warn  "Start the stack first:  ./scripts/start.sh"
    exit 1
  fi

  info "Running tests inside the 'backend' container..."
  info "Command: ${PYTEST_CMD}"
  echo ""
  echo -e "${BOLD}------------------------------------------------------------${NC}"
  echo ""

  # shellcheck disable=SC2086
  docker compose exec backend bash -c "${PYTEST_CMD}"
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
EXIT_CODE=$?
echo ""
echo -e "${BOLD}------------------------------------------------------------${NC}"
if [[ ${EXIT_CODE} -eq 0 ]]; then
  success "All tests passed."
else
  error   "Tests failed (exit code: ${EXIT_CODE})."
fi
echo ""
exit ${EXIT_CODE}