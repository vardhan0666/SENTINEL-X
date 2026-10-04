import { useCallback, useEffect, useMemo, useState } from "react";
import PageContainer from "../components/layout/PageContainer";
import { getSystemHealth } from "../services/analyticsService";
import type { SystemHealthResponse } from "../types/analytics";

function healthMeta(
  status: SystemHealthResponse["overall_status"],
): {
  label: string;
  textClass: string;
  borderClass: string;
  bgClass: string;
  dotClass: string;
  glowClass: string;
} {
  if (status === "healthy") {
    return {
      label: "HEALTHY",
      textClass: "text-emerald-300",
      borderClass: "border-emerald-500/30",
      bgClass: "bg-emerald-500/5",
      dotClass: "bg-emerald-400",
      glowClass: "shadow-[0_0_30px_rgba(52,211,153,0.08)]",
    };
  }

  if (status === "degraded") {
    return {
      label: "DEGRADED",
      textClass: "text-amber-300",
      borderClass: "border-amber-500/30",
      bgClass: "bg-amber-500/5",
      dotClass: "bg-amber-400",
      glowClass: "shadow-[0_0_30px_rgba(251,191,36,0.07)]",
    };
  }

  return {
    label: "OFFLINE",
    textClass: "text-red-300",
    borderClass: "border-red-500/30",
    bgClass: "bg-red-500/5",
    dotClass: "bg-red-400",
    glowClass: "shadow-[0_0_30px_rgba(248,113,113,0.08)]",
  };
}

function formatTime(value: unknown): string {
  if (!value) {
    return "—";
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function formatLatency(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(1)} ms`;
}

function serviceStatusMeta(
  status: SystemHealthResponse["overall_status"],
) {
  return healthMeta(status);
}

export default function SystemHealthPage() {
  const [health, setHealth] =
    useState<SystemHealthResponse | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async function () {
    setLoading(true);

    try {
      const result = await getSystemHealth();

      setHealth(result);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load system health.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(
    function () {
      void load();
    },
    [load],
  );

  const healthyServices = useMemo(
    function () {
      if (!health) {
        return 0;
      }

      return health.services.filter(
        function (service) {
          return service.status === "healthy";
        },
      ).length;
    },
    [health],
  );

  const degradedServices = useMemo(
    function () {
      if (!health) {
        return 0;
      }

      return health.services.filter(
        function (service) {
          return service.status === "degraded";
        },
      ).length;
    },
    [health],
  );

  const offlineServices = useMemo(
    function () {
      if (!health) {
        return 0;
      }

      return health.services.length -
        healthyServices -
        degradedServices;
    },
    [health, healthyServices, degradedServices],
  );

  return (
    <PageContainer
      title="System Health"
      subtitle="Backend health, dependency state and pipeline indicators"
    >
      <div className="min-h-full space-y-6 bg-[#050706] text-white">
        {/* Command header */}
        <section className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#07100c] p-6 shadow-[0_0_45px_rgba(16,185,129,0.06)]">
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(16,185,129,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.07) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
          </div>

          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-emerald-400/10" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-400/70">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                SENTINEL-X SYSTEM MONITOR
              </div>

              <h1 className="text-3xl font-black uppercase tracking-[0.08em] text-white">
                Infrastructure Health
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/40">
                Backend availability, database connectivity, ML readiness,
                ingestion state, and service dependency telemetry.
              </p>
            </div>

            {health && (
              <div
                className={
                  "flex items-center gap-3 rounded-xl border px-5 py-4 " +
                  healthMeta(health.overall_status).borderClass +
                  " " +
                  healthMeta(health.overall_status).bgClass +
                  " " +
                  healthMeta(health.overall_status).glowClass
                }
              >
                <span
                  className={
                    "h-3 w-3 animate-pulse rounded-full " +
                    healthMeta(health.overall_status).dotClass
                  }
                />

                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
                    Overall Posture
                  </div>

                  <div
                    className={
                      "mt-1 font-mono text-sm font-black tracking-[0.15em] " +
                      healthMeta(health.overall_status).textClass
                    }
                  >
                    {healthMeta(health.overall_status).label}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Loading state */}
        {loading && (
          <section className="rounded-2xl border border-white/10 bg-[#070a08] p-10">
            <div className="flex min-h-[280px] items-center justify-center">
              <div className="text-center">
                <div className="relative mx-auto h-16 w-16">
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/5 border-t-emerald-400" />
                  <div className="absolute inset-3 rounded-full border border-emerald-500/10" />
                  <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400" />
                </div>

                <div className="mt-6 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400/60">
                  Scanning infrastructure
                </div>

                <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/20">
                  Establishing telemetry channel...
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Error */}
        {error && (
          <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-400" />

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-300">
                  Health Query Failure
                </div>

                <p className="mt-2 text-sm leading-6 text-red-200/70">
                  {error}
                </p>
              </div>
            </div>
          </section>
        )}

        {!loading && health && (
          <>
            {/* Core metrics */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Pipeline"
                value={
                  health.event_pipeline_active
                    ? "ACTIVE"
                    : "STOPPED"
                }
                detail="Event processing engine"
                state={
                  health.event_pipeline_active
                    ? "healthy"
                    : "critical"
                }
              />

              <MetricCard
                label="Database"
                value={
                  health.db_connection === undefined
                    ? "UNKNOWN"
                    : health.db_connection
                      ? "ONLINE"
                      : "OFFLINE"
                }
                detail="PostgreSQL connectivity"
                state={
                  health.db_connection === undefined
                    ? "neutral"
                    : health.db_connection
                      ? "healthy"
                      : "critical"
                }
              />

              <MetricCard
                label="ML Models"
                value={
                  health.ml_models_loaded === undefined
                    ? "UNKNOWN"
                    : health.ml_models_loaded
                      ? "READY"
                      : "NOT READY"
                }
                detail="Anomaly detection layer"
                state={
                  health.ml_models_loaded === undefined
                    ? "neutral"
                    : health.ml_models_loaded
                      ? "healthy"
                      : "critical"
                }
              />

              <MetricCard
                label="Ingestion"
                value={
                  health.ingestion_rate === undefined
                    ? "—"
                    : `${health.ingestion_rate.toFixed(2)} /s`
                }
                detail="Current event throughput"
                state="healthy"
              />
            </section>

            {/* Service matrix */}
            <section className="rounded-2xl border border-white/10 bg-[#070a08] shadow-[0_0_35px_rgba(0,0,0,0.3)]">
              <div className="border-b border-white/7 bg-black/20 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/65">
                      Dependency Matrix
                    </div>

                    <div className="mt-1 text-xs text-white/25">
                      Live service health and response telemetry
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 font-mono text-[9px] uppercase tracking-[0.14em]">
                    <span className="text-emerald-300/60">
                      {healthyServices} HEALTHY
                    </span>

                    <span className="text-amber-300/60">
                      {degradedServices} DEGRADED
                    </span>

                    <span className="text-red-300/60">
                      {offlineServices} OFFLINE
                    </span>
                  </div>
                </div>
              </div>

              {health.services.length === 0 ? (
                <div className="p-8 text-center text-xs text-white/25">
                  No service telemetry is currently available.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {health.services.map(function (service) {
                    const meta = serviceStatusMeta(
                      service.status,
                    );

                    return (
                      <div
                        key={service.name}
                        className="group px-5 py-5 transition hover:bg-emerald-500/[0.025]"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <div
                                className={
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border " +
                                  meta.borderClass +
                                  " " +
                                  meta.bgClass
                                }
                              >
                                <span
                                  className={
                                    "h-2.5 w-2.5 rounded-full " +
                                    meta.dotClass
                                  }
                                />
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold uppercase tracking-wide text-white/75">
                                  {service.name}
                                </div>

                                <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/20">
                                  Last checked{" "}
                                  {formatTime(
                                    service.last_checked,
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            {service.latency_ms !==
                              undefined && (
                              <div className="min-w-[100px]">
                                <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/20">
                                  Latency
                                </div>

                                <div className="mt-1 font-mono text-xs font-bold text-white/55">
                                  {formatLatency(
                                    service.latency_ms,
                                  )}
                                </div>
                              </div>
                            )}

                            <span
                              className={
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] " +
                                meta.borderClass +
                                " " +
                                meta.bgClass +
                                " " +
                                meta.textClass
                              }
                            >
                              <span
                                className={
                                  "h-1.5 w-1.5 rounded-full " +
                                  meta.dotClass
                                }
                              />
                              {meta.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Operational telemetry */}
            <section className="grid gap-5 lg:grid-cols-3">
              <TelemetryPanel
                label="Pipeline State"
                value={
                  health.event_pipeline_active
                    ? "RUNNING"
                    : "STOPPED"
                }
                detail="Detection and correlation processing"
                healthy={health.event_pipeline_active}
              />

              <TelemetryPanel
                label="Database State"
                value={
                  health.db_connection === undefined
                    ? "UNKNOWN"
                    : health.db_connection
                      ? "CONNECTED"
                      : "DISCONNECTED"
                }
                detail="Primary PostgreSQL database"
                healthy={
                  health.db_connection === true
                }
              />

              <TelemetryPanel
                label="Model State"
                value={
                  health.ml_models_loaded ===
                  undefined
                    ? "UNKNOWN"
                    : health.ml_models_loaded
                      ? "LOADED"
                      : "UNAVAILABLE"
                }
                detail="Isolation Forest anomaly engine"
                healthy={
                  health.ml_models_loaded === true
                }
              />
            </section>

            {/* Footer controls */}
            <section className="flex flex-col gap-4 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400/60">
                    Telemetry Channel Active
                  </span>
                </div>

                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-white/20">
                  Last system check:{" "}
                  {formatTime(health.timestamp)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                data-cursor-target="refresh health"
                className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 transition hover:border-emerald-300/45 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading
                  ? "Scanning..."
                  : "↻ Refresh Telemetry"}
              </button>
            </section>
          </>
        )}
      </div>
    </PageContainer>
  );
}

function MetricCard({
  label,
  value,
  detail,
  state,
}: {
  label: string;
  value: string;
  detail: string;
  state: "healthy" | "critical" | "neutral";
}) {
  const stateClasses = {
    healthy: {
      border: "border-emerald-500/15",
      value: "text-emerald-300",
      dot: "bg-emerald-400",
    },
    critical: {
      border: "border-red-500/20",
      value: "text-red-300",
      dot: "bg-red-400",
    },
    neutral: {
      border: "border-white/10",
      value: "text-white/65",
      dot: "bg-white/25",
    },
  }[state];

  return (
    <div
      className={
        "rounded-xl border bg-[#070a08] p-5 " +
        stateClasses.border
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
          {label}
        </span>

        <span
          className={
            "h-1.5 w-1.5 rounded-full " +
            stateClasses.dot
          }
        />
      </div>

      <div
        className={
          "mt-3 font-mono text-xl font-black tracking-wide " +
          stateClasses.value
        }
      >
        {value}
      </div>

      <div className="mt-2 text-[9px] uppercase tracking-[0.13em] text-white/20">
        {detail}
      </div>
    </div>
  );
}

function TelemetryPanel({
  label,
  value,
  detail,
  healthy,
}: {
  label: string;
  value: string;
  detail: string;
  healthy: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#070a08] p-5">
      <div className="flex items-center gap-2">
        <span
          className={
            "h-2 w-2 rounded-full " +
            (healthy
              ? "animate-pulse bg-emerald-400"
              : "bg-red-400")
          }
        />

        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
          {label}
        </span>
      </div>

      <div
        className={
          "mt-4 font-mono text-lg font-black " +
          (healthy
            ? "text-emerald-300"
            : "text-red-300")
        }
      >
        {value}
      </div>

      <div className="mt-2 text-[9px] uppercase tracking-[0.13em] text-white/20">
        {detail}
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5">
        <div
          className={
            "h-full rounded-full " +
            (healthy
              ? "w-full bg-emerald-400/60"
              : "w-1/3 bg-red-400/50")
          }
        />
      </div>
    </div>
  );
}