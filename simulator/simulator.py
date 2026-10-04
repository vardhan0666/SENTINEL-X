"""
Sentinel-X Simulator — Main Entry Point
=========================================
Generates and ingests synthetic defensive telemetry into the
Sentinel-X backend via the existing event ingestion API.

Configuration is read entirely from environment variables — no
credentials are hardcoded.

Environment variables:
  BACKEND_URL       Base URL of the backend  (default: http://backend:8000)
  SIM_USERNAME      Simulator service-account username
  SIM_PASSWORD      Simulator service-account password
  SIM_MODE          Scenario mode (see below)  default: mixed
  SIM_RATE_EVENTS   Target events per second   default: 2.0
  SIM_BATCH_SIZE    Events per batch send       default: 10
  SIM_DURATION_SEC  Run duration in seconds     default: 0 (run forever)
  SIM_LOG_LEVEL     Log level                   default: INFO

SIM_MODE values:
  mixed             Continuous mix of normal + occasional attack scenarios
  baseline          Normal baseline events only
  brute_force       Brute force scenario events only
  account_compromise  Account compromise scenario events only
  network_anomaly   Network anomaly scenario events only
  dns_anomaly       DNS anomaly scenario events only
  scenario_cycle    Cycle through all attack scenarios sequentially

Design notes:
  - Uses asyncio.  Single process, no Redis/Kafka needed.
  - Respects backend rate; backs off on 429.
  - Sends events in batches (POST /api/v1/events/batch) for efficiency.
  - Individual event mode available when batch size = 1.
  - Duplicates are avoided via uuid4 event_id (already in each generator).
  - Safe to interrupt at any time (SIGINT / SIGTERM).
"""

from __future__ import annotations

import asyncio
import os
import random
import signal
import sys
import time
from typing import Any, Callable

import structlog
import structlog.dev

from client import SimulatorClient
from scenarios import normal_baseline, brute_force, account_compromise
from scenarios import network_anomaly, dns_anomaly

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(__import__("logging"), os.getenv("SIM_LOG_LEVEL", "INFO"))
    ),
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger("sentinel-x.simulator")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


def _get_config() -> dict[str, Any]:
    return {
        "backend_url": os.getenv("BACKEND_URL", "http://backend:8000"),
        "username": os.getenv("SIM_USERNAME", ""),
        "password": os.getenv("SIM_PASSWORD", ""),
        "mode": os.getenv("SIM_MODE", "mixed").lower().strip(),
        "rate": float(os.getenv("SIM_RATE_EVENTS", "2.0")),
        "batch_size": int(os.getenv("SIM_BATCH_SIZE", "10")),
        "duration": float(os.getenv("SIM_DURATION_SEC", "0")),
    }


def _validate_config(cfg: dict[str, Any]) -> None:
    if not cfg["username"]:
        logger.error("config.error", msg="SIM_USERNAME is required")
        sys.exit(1)
    if not cfg["password"]:
        logger.error("config.error", msg="SIM_PASSWORD is required")
        sys.exit(1)
    if cfg["rate"] <= 0:
        logger.error("config.error", msg="SIM_RATE_EVENTS must be > 0")
        sys.exit(1)
    if cfg["batch_size"] < 1 or cfg["batch_size"] > 1000:
        logger.error("config.error", msg="SIM_BATCH_SIZE must be 1–1000")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Event stream generators (async generators)
# ---------------------------------------------------------------------------

# Probability that any given batch-interval will inject an attack scenario
_ATTACK_PROBABILITY = 0.15


async def _stream_mixed(cfg: dict[str, Any]):
    """
    Continuous mixed stream:
    - Mostly normal baseline events
    - Occasionally inject a complete attack scenario as a burst
    """
    attack_scenarios: list[Callable[[], list[dict[str, Any]]]] = [
        lambda: brute_force.generate_scenario(
            failure_count=random.randint(5, 25),
            include_success=random.random() > 0.5,
            include_lockout=random.random() > 0.4,
        ),
        account_compromise.generate_scenario,
        network_anomaly.generate_scenario,
        dns_anomaly.generate_scenario,
    ]

    while True:
        if random.random() < _ATTACK_PROBABILITY:
            scenario_fn = random.choice(attack_scenarios)
            events = scenario_fn()
            logger.info(
                "simulator.attack_scenario",
                count=len(events),
            )
            yield events
        else:
            events = normal_baseline.generate_batch(cfg["batch_size"])
            yield events


async def _stream_baseline(cfg: dict[str, Any]):
    while True:
        yield normal_baseline.generate_batch(cfg["batch_size"])


async def _stream_brute_force(cfg: dict[str, Any]):
    while True:
        events = brute_force.generate_scenario(
            failure_count=random.randint(5, 30),
            include_success=True,
            include_lockout=True,
        )
        yield events
        await asyncio.sleep(5.0)


async def _stream_account_compromise(_cfg: dict[str, Any]):
    while True:
        yield account_compromise.generate_scenario()
        await asyncio.sleep(10.0)


async def _stream_network_anomaly(_cfg: dict[str, Any]):
    while True:
        yield network_anomaly.generate_scenario()
        await asyncio.sleep(8.0)


async def _stream_dns_anomaly(_cfg: dict[str, Any]):
    while True:
        yield dns_anomaly.generate_scenario()
        await asyncio.sleep(8.0)


async def _stream_scenario_cycle(_cfg: dict[str, Any]):
    """Cycle through each attack scenario sequentially."""
    generators = [
        brute_force.generate_scenario,
        account_compromise.generate_scenario,
        network_anomaly.generate_scenario,
        dns_anomaly.generate_scenario,
    ]
    idx = 0
    while True:
        fn = generators[idx % len(generators)]
        yield fn()
        idx += 1
        await asyncio.sleep(15.0)


_STREAM_MAP: dict[str, Any] = {
    "mixed": _stream_mixed,
    "baseline": _stream_baseline,
    "brute_force": _stream_brute_force,
    "account_compromise": _stream_account_compromise,
    "network_anomaly": _stream_network_anomaly,
    "dns_anomaly": _stream_dns_anomaly,
    "scenario_cycle": _stream_scenario_cycle,
}

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------


class _RateLimiter:
    """
    Token-bucket rate limiter.
    Allows bursting up to 2× the configured rate for scenario injections.
    """

    def __init__(self, rate_per_second: float) -> None:
        self._rate = rate_per_second
        self._tokens = rate_per_second
        self._last = time.monotonic()

    async def acquire(self, count: int = 1) -> None:
        """Wait until *count* tokens are available."""
        while True:
            now = time.monotonic()
            elapsed = now - self._last
            self._last = now
            self._tokens = min(
                self._rate * 2,  # burst cap
                self._tokens + elapsed * self._rate,
            )
            if self._tokens >= count:
                self._tokens -= count
                return
            # Need to wait for enough tokens
            deficit = count - self._tokens
            wait = deficit / self._rate
            await asyncio.sleep(wait)


# ---------------------------------------------------------------------------
# Ingestion loop
# ---------------------------------------------------------------------------


async def _ingest_loop(
    client: SimulatorClient,
    cfg: dict[str, Any],
    stop_event: asyncio.Event,
) -> None:
    mode = cfg["mode"]
    if mode not in _STREAM_MAP:
        logger.error(
            "simulator.unknown_mode",
            mode=mode,
            available=list(_STREAM_MAP.keys()),
        )
        stop_event.set()
        return

    stream_factory = _STREAM_MAP[mode]
    rate_limiter = _RateLimiter(cfg["rate"])
    start_time = time.monotonic()
    duration = cfg["duration"]
    batch_size = cfg["batch_size"]

    total_sent = 0
    total_batches = 0
    total_errors = 0

    logger.info(
        "simulator.start",
        mode=mode,
        rate_per_sec=cfg["rate"],
        batch_size=batch_size,
        duration_sec=duration or "unlimited",
        backend=cfg["backend_url"],
    )

    async for event_batch in stream_factory(cfg):
        if stop_event.is_set():
            break

        if duration > 0 and (time.monotonic() - start_time) >= duration:
            logger.info("simulator.duration_reached", duration=duration)
            break

        if not event_batch:
            continue

        # Chunk into batches respecting the 1000-event API limit and config
        chunks = _chunk(event_batch, min(batch_size, 1000))

        for chunk in chunks:
            await rate_limiter.acquire(len(chunk))

            try:
                if len(chunk) == 1:
                    resp = await client.send_event(chunk[0])
                else:
                    resp = await client.send_batch(chunk)

                total_sent += len(chunk)
                total_batches += 1

                if total_batches % 10 == 0:
                    logger.info(
                        "simulator.progress",
                        total_sent=total_sent,
                        total_batches=total_batches,
                        total_errors=total_errors,
                        elapsed_sec=round(time.monotonic() - start_time, 1),
                    )

            except Exception as exc:
                total_errors += 1
                logger.error(
                    "simulator.send_error",
                    error=str(exc),
                    chunk_size=len(chunk),
                    total_errors=total_errors,
                )
                if total_errors > 50:
                    logger.critical(
                        "simulator.too_many_errors",
                        total_errors=total_errors,
                        msg="Stopping simulator after excessive errors",
                    )
                    stop_event.set()
                    break

                # Back-off on errors
                await asyncio.sleep(min(2.0 * total_errors, 30.0))

            if stop_event.is_set():
                break

    logger.info(
        "simulator.finished",
        total_sent=total_sent,
        total_batches=total_batches,
        total_errors=total_errors,
        elapsed_sec=round(time.monotonic() - start_time, 1),
    )


def _chunk(lst: list, size: int) -> list[list]:
    """Split *lst* into sub-lists of at most *size* items."""
    return [lst[i : i + size] for i in range(0, len(lst), size)]


# ---------------------------------------------------------------------------
# Startup health check — wait for backend to be ready
# ---------------------------------------------------------------------------


async def _wait_for_backend(base_url: str, max_wait: float = 120.0) -> None:
    """
    Poll the backend health endpoint until it responds 200.
    Prevents the simulator from hammering the backend before it is ready.
    """
    import httpx

    health_url = f"{base_url}/api/v1/health"
    waited = 0.0
    interval = 3.0

    logger.info("simulator.backend_wait", url=health_url)

    async with httpx.AsyncClient(timeout=5.0) as http:
        while waited < max_wait:
            try:
                resp = await http.get(health_url)
                if resp.status_code == 200:
                    logger.info("simulator.backend_ready", waited_sec=round(waited, 1))
                    return
            except Exception:
                pass

            await asyncio.sleep(interval)
            waited += interval

    logger.warning(
        "simulator.backend_not_ready",
        max_wait=max_wait,
        msg="Proceeding anyway — backend may still be starting",
    )


# ---------------------------------------------------------------------------
# Signal handling
# ---------------------------------------------------------------------------


def _install_signal_handlers(stop_event: asyncio.Event, loop: asyncio.AbstractEventLoop) -> None:
    def _handler(sig: int, _: Any) -> None:
        logger.info("simulator.signal", signal=sig)
        loop.call_soon_threadsafe(stop_event.set)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, lambda s=sig: _handler(s, None))
        except (NotImplementedError, RuntimeError):
            # Windows fallback
            signal.signal(sig, _handler)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def _main() -> None:
    cfg = _get_config()
    _validate_config(cfg)

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    _install_signal_handlers(stop_event, loop)

    # Wait for the backend to be reachable before authenticating
    await _wait_for_backend(cfg["backend_url"])

    async with SimulatorClient(
        base_url=cfg["backend_url"],
        username=cfg["username"],
        password=cfg["password"],
    ) as client:
        await _ingest_loop(client, cfg, stop_event)


def main() -> None:
    try:
        asyncio.run(_main())
    except KeyboardInterrupt:
        logger.info("simulator.interrupted")
    except Exception as exc:
        logger.critical("simulator.fatal", error=str(exc))
        sys.exit(1)


if __name__ == "__main__":
    main()