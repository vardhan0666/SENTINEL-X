"""Read-only simulation control-plane API for SENTINEL-X.

The simulator is a separate Docker service. The backend intentionally does not
control the host Docker daemon, so this API exposes the supported simulator
configuration and operator-facing status without pretending to start or stop
an external container process.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser

router = APIRouter(prefix="/simulation", tags=["simulation"])

SimulationMode = Literal[
    "mixed",
    "baseline",
    "brute_force",
    "account_compromise",
    "network_anomaly",
    "dns_anomaly",
    "scenario_cycle",
]

_MODES: tuple[SimulationMode, ...] = (
    "mixed",
    "baseline",
    "brute_force",
    "account_compromise",
    "network_anomaly",
    "dns_anomaly",
    "scenario_cycle",
)


class SimulationModeInfo(BaseModel):
    mode: SimulationMode
    description: str


class SimulationStatus(BaseModel):
    service: str = "sentinel-x-simulator"
    backend_control_supported: bool = False
    externally_managed: bool = True
    configured_mode: SimulationMode
    configured_rate_events: float = Field(gt=0)
    configured_batch_size: int = Field(ge=1, le=1000)
    configured_duration_seconds: float = Field(ge=0)
    simulator_backend_url: str
    checked_at: datetime
    management_note: str


def _configured_mode() -> SimulationMode:
    value = os.getenv("SIM_MODE", "mixed").strip().lower()
    return value if value in _MODES else "mixed"  # type: ignore[return-value]


def _configured_rate() -> float:
    try:
        value = float(os.getenv("SIM_RATE_EVENTS", "2.0"))
    except ValueError:
        value = 2.0
    return value if value > 0 else 2.0


def _configured_batch_size() -> int:
    try:
        value = int(os.getenv("SIM_BATCH_SIZE", "10"))
    except ValueError:
        value = 10
    return max(1, min(value, 1000))


def _configured_duration() -> float:
    try:
        value = float(os.getenv("SIM_DURATION_SEC", "0"))
    except ValueError:
        value = 0.0
    return max(0.0, value)


@router.get("/modes", response_model=list[SimulationModeInfo])
async def list_simulation_modes(_: CurrentUser) -> list[SimulationModeInfo]:
    descriptions = {
        "mixed": "Normal baseline telemetry with occasional synthetic anomaly scenarios.",
        "baseline": "Synthetic normal baseline telemetry only.",
        "brute_force": "Synthetic authentication brute-force telemetry only.",
        "account_compromise": "Synthetic account-compromise telemetry only.",
        "network_anomaly": "Synthetic network-anomaly telemetry only.",
        "dns_anomaly": "Synthetic DNS-anomaly telemetry only.",
        "scenario_cycle": "Synthetic anomaly scenarios cycled sequentially.",
    }
    return [SimulationModeInfo(mode=mode, description=descriptions[mode]) for mode in _MODES]


@router.get("/status", response_model=SimulationStatus)
async def simulation_status(_: CurrentUser) -> SimulationStatus:
    return SimulationStatus(
        configured_mode=_configured_mode(),
        configured_rate_events=_configured_rate(),
        configured_batch_size=_configured_batch_size(),
        configured_duration_seconds=_configured_duration(),
        simulator_backend_url=os.getenv("BACKEND_URL", "http://backend:8000"),
        checked_at=datetime.now(timezone.utc),
        management_note=(
            "The simulator is managed as a separate Docker Compose service. "
            "Use scripts/run_simulator.sh or `docker compose --profile simulation up --build simulator` "
            "to start it; the backend does not access the host Docker daemon."
        ),
    )
