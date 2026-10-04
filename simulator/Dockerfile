# ---------------------------------------------------------------------------
# Sentinel-X Simulator — Dockerfile
# ---------------------------------------------------------------------------
# This container runs the standalone event simulator that generates
# synthetic defensive telemetry and sends it to the backend API.
#
# Build context: ./simulator
#
# The simulator service is defined in docker-compose.yml under the
# "simulation" profile and depends on the backend service.
# ---------------------------------------------------------------------------

FROM python:3.11-slim

# Non-root user for security
RUN groupadd --gid 1001 simulator \
 && useradd --uid 1001 --gid simulator --shell /bin/bash --create-home simulator

WORKDIR /app

# Install dependencies first (layer cache friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy simulator source
COPY . .

# Ensure the scenarios package is importable
RUN python -c "from scenarios import normal_baseline, brute_force, account_compromise, network_anomaly, dns_anomaly; print('import OK')"

USER simulator

# Environment defaults (overridden by docker-compose / .env)
ENV BACKEND_URL=http://backend:8000 \
    SIM_MODE=mixed \
    SIM_RATE_EVENTS=2.0 \
    SIM_BATCH_SIZE=10 \
    SIM_DURATION_SEC=0 \
    SIM_LOG_LEVEL=INFO

# SIM_USERNAME and SIM_PASSWORD must be supplied at runtime.
# Do NOT add them here.

CMD ["python", "simulator.py"]