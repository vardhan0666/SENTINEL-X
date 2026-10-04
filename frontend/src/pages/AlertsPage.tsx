import {
  useEffect,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  Bell,
  Clock3,
  Crosshair,
  Database,
  Radio,
  RefreshCw,
  ShieldAlert,
  Terminal,
} from "lucide-react";

import PageContainer from "../components/layout/PageContainer";
import apiClient from "../services/apiClient";

type Row = Record<string, unknown>;

interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

function rowsFrom(
  value: unknown,
): Row[] {
  if (Array.isArray(value)) {
    return value.filter(
      (
        item,
      ): item is Row =>
        typeof item === "object" &&
        item !== null,
    );
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const candidate =
      value as Record<
        string,
        unknown
      >;

    for (const key of [
      "items",
      "alerts",
      "data",
    ]) {
      const possibleRows =
        candidate[key];

      if (
        Array.isArray(
          possibleRows,
        )
      ) {
        return possibleRows.filter(
          (
            item,
          ): item is Row =>
            typeof item ===
              "object" &&
            item !== null,
        );
      }
    }
  }

  return [];
}

function display(
  row: Row,
  keys: string[],
  fallback = "—",
): string {
  for (const key of keys) {
    const value =
      row[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return typeof value === "object"
        ? JSON.stringify(
            value,
          )
        : String(value);
    }
  }

  return fallback;
}

function normalizeSeverity(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}

interface SeverityVisual {
  label: string;
  text: string;
  border: string;
  bg: string;
  dot: string;
}

function severityVisual(
  value: string,
): SeverityVisual {
  const severity =
    normalizeSeverity(
      value,
    );

  if (
    severity === "critical"
  ) {
    return {
      label: "CRITICAL",
      text: "text-red-300",
      border:
        "border-red-800/70",
      bg: "bg-red-500/[0.08]",
      dot: "bg-red-300",
    };
  }

  if (
    severity === "high"
  ) {
    return {
      label: "HIGH",
      text: "text-orange-300",
      border:
        "border-orange-800/70",
      bg: "bg-orange-500/[0.07]",
      dot: "bg-orange-300",
    };
  }

  if (
    severity === "medium"
  ) {
    return {
      label: "MEDIUM",
      text: "text-amber-300",
      border:
        "border-amber-800/70",
      bg: "bg-amber-500/[0.07]",
      dot: "bg-amber-300",
    };
  }

  if (
    severity === "low"
  ) {
    return {
      label: "LOW",
      text: "text-emerald-300",
      border:
        "border-emerald-900/70",
      bg: "bg-emerald-500/[0.05]",
      dot: "bg-emerald-300",
    };
  }

  return {
    label:
      value.trim().toUpperCase() ||
      "UNKNOWN",
    text: "text-slate-400",
    border: "border-slate-800",
    bg: "bg-slate-900/30",
    dot: "bg-slate-500",
  };
}

function formatTimestamp(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    [],
    {
      hour12: false,
    },
  );
}

function AlertRow({
  row,
  index,
}: {
  row: Row;
  index: number;
}): React.JSX.Element {
  const severity =
    display(row, [
      "severity",
      "risk_level",
    ]);

  const visual =
    severityVisual(
      severity,
    );

  const title =
    display(row, [
      "title",
      "name",
      "rule_name",
    ]);

  const message =
    display(row, [
      "message",
      "description",
      "reason",
    ]);

  const created =
    display(row, [
      "created_at",
      "timestamp",
      "detected_at",
    ]);

  const rule =
    display(row, [
      "rule_name",
      "detection_type",
      "type",
    ]);

  const alertId =
    display(row, [
      "id",
      "alert_id",
      "detection_id",
    ]);

  return (
    <div
      className="group relative border-b border-emerald-950/50 px-4 py-4 transition-all duration-300 hover:bg-emerald-400/[0.025]"
      style={{
        animation:
          "sentinelAlertIn .25s ease-out",
        animationDelay: `${Math.min(
          index * 18,
          180,
        )}ms`,
      }}
    >
      <div className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-transparent to-transparent transition-all duration-300 group-hover:via-emerald-300/50" />

      <div className="grid gap-4 xl:grid-cols-[125px_1fr_180px_155px] xl:items-center">
        <div>
          <span
            className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[7px] font-bold tracking-[0.14em] ${visual.border} ${visual.bg} ${visual.text}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${visual.dot}`}
            />
            {visual.label}
          </span>

          <div className="mt-2 flex items-center gap-2 font-mono text-[7px] text-slate-800">
            <Clock3 size={10} />
            {created !== "—"
              ? formatTimestamp(
                  created,
                )
              : "NO TIMESTAMP"}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-950 bg-emerald-400/[0.035]">
              <ShieldAlert
                size={14}
                className="text-emerald-300"
              />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[11px] font-bold tracking-wide text-white">
                {title}
              </div>

              <div className="mt-1 line-clamp-2 text-[9px] leading-5 text-slate-600">
                {message}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {rule !== "—" && (
                  <span className="rounded border border-emerald-950 bg-black/20 px-2 py-0.5 font-mono text-[6px] tracking-[0.12em] text-emerald-800">
                    RULE // {rule}
                  </span>
                )}

                {alertId !== "—" && (
                  <span className="font-mono text-[6px] tracking-[0.12em] text-slate-900">
                    ID{" "}
                    {alertId.slice(
                      0,
                      12,
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="font-mono text-[7px] tracking-[0.16em] text-slate-800">
            DETECTION STATE
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300 opacity-30" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-300" />
            </span>

            <span className="font-mono text-[8px] font-bold tracking-[0.14em] text-emerald-300">
              DETECTED
            </span>
          </div>
        </div>

        <div className="xl:text-right">
          <div className="font-mono text-[7px] tracking-[0.16em] text-slate-800">
            TRIAGE
          </div>

          <div className="mt-2 text-[9px] leading-4 text-slate-600">
            Review detection context
            and linked telemetry.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage(): React.JSX.Element {
  const [
    rows,
    setRows,
  ] = useState<Row[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState<Date | null>(
    null,
  );

  async function load(): Promise<void> {
    setLoading(true);

    try {
      const response =
        await apiClient.get<unknown>(
          "/alerts",
        );

      setRows(
        rowsFrom(response),
      );

      setLastUpdated(
        new Date(),
      );

      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load alerts.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const severityCounts: SeverityCounts =
    {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

  for (const row of rows) {
    const severity =
      normalizeSeverity(
        display(
          row,
          [
            "severity",
            "risk_level",
          ],
          "",
        ),
      );

    if (
      severity === "critical"
    ) {
      severityCounts.critical += 1;
    }

    if (
      severity === "high"
    ) {
      severityCounts.high += 1;
    }

    if (
      severity === "medium"
    ) {
      severityCounts.medium += 1;
    }

    if (
      severity === "low"
    ) {
      severityCounts.low += 1;
    }
  }

  const criticalCount =
    severityCounts.critical;

  const highCount =
    severityCounts.high;

  const elevatedCount =
    criticalCount +
    highCount;

  let posture =
    "NOMINAL";

  if (
    criticalCount > 0
  ) {
    posture = "CRITICAL";
  } else if (
    highCount > 0
  ) {
    posture = "ELEVATED";
  } else if (
    rows.length > 0
  ) {
    posture = "GUARDED";
  }

  return (
    <PageContainer
      title="Alerts"
      subtitle="SENTINEL-X detection operations // security alert queue"
    >
      <style>
        {`
          @keyframes sentinelAlertIn {
            from {
              opacity: 0;
              transform: translateY(-4px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes sentinelAlertScan {
            0% {
              transform: translateY(-120%);
            }

            100% {
              transform: translateY(120%);
            }
          }

          @keyframes sentinelAlertPulse {
            0%,
            100% {
              opacity: .25;
            }

            50% {
              opacity: 1;
            }
          }

          .sentinel-alert-grid {
            background-image:
              linear-gradient(
                rgba(70,255,140,.025) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(70,255,140,.025) 1px,
                transparent 1px
              );
            background-size: 34px 34px;
          }

          .sentinel-alert-scroll::-webkit-scrollbar {
            width: 7px;
          }

          .sentinel-alert-scroll::-webkit-scrollbar-track {
            background: #020603;
          }

          .sentinel-alert-scroll::-webkit-scrollbar-thumb {
            background: rgba(49,96,67,.7);
            border-radius: 999px;
          }
        `}
      </style>

      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-2xl border border-emerald-950/90 bg-[#020603]">
          <div className="sentinel-alert-grid pointer-events-none absolute inset-0" />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_45%,rgba(60,255,140,.06),transparent_25%),radial-gradient(circle_at_80%_15%,rgba(255,255,255,.025),transparent_20%)]" />

          <div
            className="pointer-events-none absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-emerald-300/[0.018] to-transparent"
            style={{
              animation:
                "sentinelAlertScan 8s linear infinite",
            }}
          />

          <div className="relative z-10 grid gap-4 p-4 xl:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-xl border border-emerald-950/80 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Bell
                      size={16}
                      className="text-emerald-300"
                    />

                    <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-emerald-500">
                      THREAT DETECTION CONSOLE
                    </span>
                  </div>

                  <div className="mt-3 text-2xl font-black tracking-tight text-white">
                    ALERT OPERATIONS
                  </div>

                  <p className="mt-1 max-w-2xl text-[9px] leading-5 text-slate-600">
                    Centralized detection output from the
                    SENTINEL-X defensive pipeline.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void load()
                  }
                  disabled={loading}
                  data-cursor-target
                  className="group flex items-center gap-2 rounded-lg border border-emerald-800/70 bg-emerald-400/[0.04] px-3 py-2 font-mono text-[8px] font-bold tracking-[0.15em] text-emerald-200 transition duration-300 hover:border-emerald-300 hover:bg-emerald-400/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCw
                    size={12}
                    className={
                      loading
                        ? "animate-spin"
                        : "transition-transform group-hover:rotate-90"
                    }
                  />

                  REFRESH
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-emerald-950 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[7px] tracking-[0.18em] text-slate-800">
                      TOTAL
                    </span>

                    <Activity
                      size={12}
                      className="text-emerald-800"
                    />
                  </div>

                  <div className="mt-3 font-mono text-lg font-black text-white">
                    {rows.length.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-lg border border-red-950/70 bg-red-950/[0.08] p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[7px] tracking-[0.18em] text-red-900">
                      CRITICAL
                    </span>

                    <AlertTriangle
                      size={12}
                      className="text-red-300"
                    />
                  </div>

                  <div className="mt-3 font-mono text-lg font-black text-red-200">
                    {criticalCount.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-lg border border-orange-950/70 bg-orange-950/[0.07] p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[7px] tracking-[0.18em] text-orange-900">
                      HIGH
                    </span>

                    <ShieldAlert
                      size={12}
                      className="text-orange-300"
                    />
                  </div>

                  <div className="mt-3 font-mono text-lg font-black text-orange-200">
                    {highCount.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-950 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[7px] tracking-[0.18em] text-slate-800">
                      ELEVATED
                    </span>

                    <Crosshair
                      size={12}
                      className="text-emerald-800"
                    />
                  </div>

                  <div className="mt-3 font-mono text-lg font-black text-emerald-300">
                    {elevatedCount.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-950/80 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-[8px] tracking-[0.18em] text-slate-700">
                    CURRENT POSTURE
                  </div>

                  <div className="mt-1 text-sm font-bold text-white">
                    Detection state
                  </div>
                </div>

                <Radio
                  size={15}
                  className="text-emerald-800"
                />
              </div>

              <div className="mt-5 flex items-center gap-4 rounded-xl border border-emerald-950 bg-black/25 p-4">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-emerald-900/80">
                  <div className="absolute inset-2 animate-pulse rounded-full border border-emerald-400/20" />

                  <ShieldAlert
                    size={24}
                    className={
                      posture === "CRITICAL"
                        ? "text-red-300"
                        : posture === "ELEVATED"
                          ? "text-orange-300"
                          : "text-emerald-300"
                    }
                  />
                </div>

                <div>
                  <div
                    className={
                      `font-mono text-xl font-black tracking-[0.1em] ` +
                      (
                        posture ===
                        "CRITICAL"
                          ? "text-red-300"
                          : posture ===
                              "ELEVATED"
                            ? "text-orange-300"
                            : "text-emerald-300"
                      )
                    }
                  >
                    {posture}
                  </div>

                  <div className="mt-1 text-[9px] leading-5 text-slate-700">
                    Derived from the alert set currently
                    returned by the backend.
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-md border border-emerald-950 bg-black/20 px-3 py-2">
                  <div className="font-mono text-[7px] tracking-[0.15em] text-slate-800">
                    LAST SYNC
                  </div>

                  <div className="mt-1 font-mono text-[9px] text-emerald-300">
                    {lastUpdated
                      ? lastUpdated.toLocaleTimeString(
                          [],
                          {
                            hour12: false,
                          },
                        )
                      : "--:--:--"}
                  </div>
                </div>

                <div className="rounded-md border border-emerald-950 bg-black/20 px-3 py-2">
                  <div className="font-mono text-[7px] tracking-[0.15em] text-slate-800">
                    PIPELINE
                  </div>

                  <div className="mt-1 font-mono text-[9px] text-emerald-300">
                    ACTIVE
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-xl border border-red-900/70 bg-red-950/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle
                size={14}
                className="text-red-300"
              />

              <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-red-400">
                ALERT SERVICE ERROR
              </span>
            </div>

            <div className="mt-1 text-[10px] text-red-300">
              {error}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-emerald-950/90 bg-[#030704]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-950/80 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-950 bg-emerald-400/[0.035]">
                <Terminal
                  size={14}
                  className="text-emerald-300"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-white">
                    DETECTION QUEUE
                  </span>

                  <span className="h-1 w-1 rounded-full bg-emerald-300" />

                  <span className="font-mono text-[7px] tracking-[0.14em] text-emerald-800">
                    /alerts
                  </span>
                </div>

                <div className="mt-0.5 text-[8px] text-slate-700">
                  Backend detection output
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 sm:flex">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-300"
                  style={{
                    animation:
                      "sentinelAlertPulse 1.4s ease-in-out infinite",
                  }}
                />

                <span className="font-mono text-[7px] tracking-[0.15em] text-emerald-800">
                  MONITORING
                </span>
              </div>

              <div className="rounded-md border border-emerald-950 bg-black/20 px-2 py-1 font-mono text-[7px] tracking-[0.14em] text-slate-700">
                {rows.length} ALERTS
              </div>
            </div>
          </div>

          <div className="sentinel-alert-scroll max-h-[680px] overflow-auto">
            {rows.map(
              (
                row,
                index,
              ) => (
                <AlertRow
                  key={`${display(
                    row,
                    [
                      "id",
                      "alert_id",
                      "detection_id",
                    ],
                    String(index),
                  )}-${index}`}
                  row={row}
                  index={index}
                />
              ),
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-emerald-900/70">
                  <div className="absolute inset-1 animate-pulse rounded-full border border-emerald-400/15" />

                  <RefreshCw
                    size={19}
                    className="animate-spin text-emerald-800"
                  />
                </div>

                <div className="mt-4 font-mono text-[9px] font-bold tracking-[0.18em] text-emerald-700">
                  SCANNING DETECTION QUEUE
                </div>

                <div className="mt-1 text-[9px] text-slate-800">
                  Loading alerts from SENTINEL-X backend.
                </div>
              </div>
            )}

            {!loading &&
              rows.length ===
                0 && (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-emerald-900/70">
                    <div className="absolute inset-1 animate-pulse rounded-full border border-emerald-400/15" />

                    <Bell
                      size={20}
                      className="text-emerald-900"
                    />
                  </div>

                  <div className="mt-4 font-mono text-[9px] font-bold tracking-[0.18em] text-slate-600">
                    DETECTION QUEUE CLEAR
                  </div>

                  <div className="mt-1 max-w-md text-[9px] leading-5 text-slate-800">
                    The backend returned no alerts.
                    SENTINEL-X continues monitoring for
                    new detections.
                  </div>
                </div>
              )}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-4">
            <div className="flex items-center gap-2">
              <Database
                size={14}
                className="text-emerald-300"
              />

              <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-white">
                DETECTION OUTPUT
              </span>
            </div>

            <p className="mt-2 text-[9px] leading-5 text-slate-700">
              Alerts displayed here originate from the
              SENTINEL-X backend alert service.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-4">
            <div className="flex items-center gap-2">
              <Crosshair
                size={14}
                className="text-emerald-300"
              />

              <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-white">
                TRIAGE CONSOLE
              </span>
            </div>

            <p className="mt-2 text-[9px] leading-5 text-slate-700">
              Use each alert as an investigation entry point
              into the broader telemetry and incident pipeline.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-4">
            <div className="flex items-center gap-2">
              <Radio
                size={14}
                className="text-emerald-300"
              />

              <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-white">
                DEFENSIVE MONITORING
              </span>
            </div>

            <p className="mt-2 text-[9px] leading-5 text-slate-700">
              This interface remains a monitoring surface;
              response actions belong to the authorized
              incident workflow.
            </p>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}