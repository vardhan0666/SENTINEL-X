import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listIncidents } from "../services/incidentService";
import type {
  IncidentListResponse,
  IncidentRead,
  IncidentStatus,
  PaginatedIncidents,
} from "../types/incident";

const PAGE_SIZE = 50;

const STATUS_OPTIONS: Array<{
  value: "" | IncidentStatus;
  label: string;
}> = [
  { value: "", label: "ALL STATUSES" },
  { value: "NEW", label: "NEW" },
  { value: "INVESTIGATING", label: "INVESTIGATING" },
  { value: "CONTAINED", label: "CONTAINED" },
  { value: "RESOLVED", label: "RESOLVED" },
  { value: "FALSE_POSITIVE", label: "FALSE POSITIVE" },
];

const SEVERITY_OPTIONS = [
  { value: "", label: "ALL SEVERITIES" },
  { value: "critical", label: "CRITICAL" },
  { value: "high", label: "HIGH" },
  { value: "medium", label: "MEDIUM" },
  { value: "low", label: "LOW" },
  { value: "info", label: "INFO" },
];

function normalizeIncidents(
  response: IncidentListResponse,
): { items: IncidentRead[]; total: number } {
  if (Array.isArray(response)) {
    return {
      items: response,
      total: response.length,
    };
  }

  const paginated = response as PaginatedIncidents;

  return {
    items: Array.isArray(paginated.items) ? paginated.items : [],
    total:
      typeof paginated.total === "number"
        ? paginated.total
        : Array.isArray(paginated.items)
          ? paginated.items.length
          : 0,
  };
}

function formatStatus(status: IncidentStatus): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, function (character: string) {
      return character.toUpperCase();
    });
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getExplanationSummary(incident: IncidentRead): string {
  const explanation = incident.explanation;

  if (!explanation) {
    return "No explanation available.";
  }

  if (
    typeof explanation.summary === "string" &&
    explanation.summary.trim().length > 0
  ) {
    return explanation.summary;
  }

  return "No explanation summary available.";
}

function normalizeSeverity(value: string): string {
  return value.toLowerCase().trim();
}

function severityTone(value: string): {
  label: string;
  className: string;
  dotClass: string;
} {
  switch (normalizeSeverity(value)) {
    case "critical":
      return {
        label: "CRITICAL",
        className:
          "border-red-500/40 bg-red-500/10 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.12)]",
        dotClass: "bg-red-400",
      };

    case "high":
      return {
        label: "HIGH",
        className:
          "border-orange-500/40 bg-orange-500/10 text-orange-300",
        dotClass: "bg-orange-400",
      };

    case "medium":
      return {
        label: "MEDIUM",
        className:
          "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
        dotClass: "bg-yellow-400",
      };

    case "low":
      return {
        label: "LOW",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        dotClass: "bg-emerald-400",
      };

    default:
      return {
        label: value.toUpperCase(),
        className:
          "border-white/10 bg-white/5 text-white/60",
        dotClass: "bg-white/40",
      };
  }
}

function statusTone(status: IncidentStatus): {
  label: string;
  className: string;
  dotClass: string;
} {
  switch (status) {
    case "NEW":
      return {
        label: "NEW",
        className:
          "border-purple-500/30 bg-purple-500/10 text-purple-300",
        dotClass: "bg-purple-400",
      };

    case "INVESTIGATING":
      return {
        label: "INVESTIGATING",
        className:
          "border-blue-500/30 bg-blue-500/10 text-blue-300",
        dotClass: "bg-blue-400",
      };

    case "CONTAINED":
      return {
        label: "CONTAINED",
        className:
          "border-orange-500/30 bg-orange-500/10 text-orange-300",
        dotClass: "bg-orange-400",
      };

    case "RESOLVED":
      return {
        label: "RESOLVED",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        dotClass: "bg-emerald-400",
      };

    case "FALSE_POSITIVE":
      return {
        label: "FALSE POSITIVE",
        className:
          "border-white/10 bg-white/5 text-white/50",
        dotClass: "bg-white/30",
      };

    default:
      return {
        label: formatStatus(status),
        className:
          "border-white/10 bg-white/5 text-white/60",
        dotClass: "bg-white/40",
      };
  }
}

function riskLevel(score: number): {
  label: string;
  className: string;
} {
  if (score >= 80) {
    return {
      label: "CRITICAL",
      className: "text-red-300",
    };
  }

  if (score >= 60) {
    return {
      label: "HIGH",
      className: "text-orange-300",
    };
  }

  if (score >= 40) {
    return {
      label: "ELEVATED",
      className: "text-yellow-300",
    };
  }

  return {
    label: "LOW",
    className: "text-emerald-300",
  };
}

function clampRisk(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, score));
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentRead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [status, setStatus] = useState<"" | IncidentStatus>("");
  const [severity, setSeverity] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(function () {
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  const criticalCount = useMemo(
    function () {
      return incidents.filter(
        function (incident) {
          return normalizeSeverity(incident.severity) === "critical";
        },
      ).length;
    },
    [incidents],
  );

  const highCount = useMemo(
    function () {
      return incidents.filter(
        function (incident) {
          return normalizeSeverity(incident.severity) === "high";
        },
      ).length;
    },
    [incidents],
  );

  const activeCount = useMemo(
    function () {
      return incidents.filter(
        function (incident) {
          return (
            incident.status === "NEW" ||
            incident.status === "INVESTIGATING"
          );
        },
      ).length;
    },
    [incidents],
  );

  const containedCount = useMemo(
    function () {
      return incidents.filter(
        function (incident) {
          return incident.status === "CONTAINED";
        },
      ).length;
    },
    [incidents],
  );

  const averageRisk = useMemo(
    function () {
      if (incidents.length === 0) {
        return 0;
      }

      const totalRisk = incidents.reduce(
        function (sum, incident) {
          return sum + Number(incident.risk_score || 0);
        },
        0,
      );

      return totalRisk / incidents.length;
    },
    [incidents],
  );

  const loadIncidents = useCallback(
    async function (targetPage: number) {
      setIsLoading(true);
      setError(null);

      try {
        const response = await listIncidents({
          limit: PAGE_SIZE,
          offset: (targetPage - 1) * PAGE_SIZE,
          status: status || undefined,
          severity: severity || undefined,
        });

        const normalized = normalizeIncidents(response);

        setIncidents(normalized.items);
        setTotal(normalized.total);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load incidents.";

        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [severity, status],
  );

  useEffect(
    function () {
      void loadIncidents(page);
    },
    [loadIncidents, page],
  );

  function handleStatusChange(value: "" | IncidentStatus) {
    setStatus(value);
    setPage(1);
  }

  function handleSeverityChange(value: string) {
    setSeverity(value);
    setPage(1);
  }

  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="min-h-full space-y-6 bg-[#050706] text-white">
      {/* Tactical header */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#07100c] p-6 shadow-[0_0_40px_rgba(16,185,129,0.06)]">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(16,185,129,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.08) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400/70">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Incident Command Center
            </div>

            <h1 className="text-3xl font-black uppercase tracking-[0.08em] text-white">
              Threat Incidents
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
              Correlated security incidents generated by the SENTINEL-X
              detection, machine-learning, and correlation pipeline.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-sm">
              <div className="text-[9px] uppercase tracking-[0.22em] text-white/35">
                Dataset
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-white">
                {total.toLocaleString()}
              </div>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <div className="text-[9px] uppercase tracking-[0.22em] text-red-300/50">
                Critical
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-red-300">
                {criticalCount}
              </div>
            </div>

            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
              <div className="text-[9px] uppercase tracking-[0.22em] text-orange-300/50">
                High
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-orange-300">
                {highCount}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <div className="text-[9px] uppercase tracking-[0.22em] text-emerald-300/50">
                Active
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-300">
                {activeCount}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Command posture */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#080c0a] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.22em] text-white/35">
              Command Posture
            </span>
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          </div>

          <div className="mt-3 text-lg font-bold uppercase text-emerald-300">
            Monitoring
          </div>

          <p className="mt-1 text-xs text-white/35">
            Correlation engine operational
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#080c0a] p-4">
          <div className="text-[9px] uppercase tracking-[0.22em] text-white/35">
            Active Queue
          </div>

          <div className="mt-3 font-mono text-2xl font-black text-white">
            {activeCount}
          </div>

          <div className="mt-1 text-xs text-white/35">
            NEW + INVESTIGATING
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#080c0a] p-4">
          <div className="text-[9px] uppercase tracking-[0.22em] text-white/35">
            Containment
          </div>

          <div className="mt-3 font-mono text-2xl font-black text-orange-300">
            {containedCount}
          </div>

          <div className="mt-1 text-xs text-white/35">
            Incidents contained
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#080c0a] p-4">
          <div className="text-[9px] uppercase tracking-[0.22em] text-white/35">
            Avg Risk
          </div>

          <div className="mt-3 flex items-end gap-2">
            <span className="font-mono text-2xl font-black text-white">
              {averageRisk.toFixed(1)}
            </span>
            <span
              className={
                "pb-1 text-[10px] font-bold uppercase tracking-wider " +
                riskLevel(averageRisk).className
              }
            >
              {riskLevel(averageRisk).label}
            </span>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-emerald-500/15 bg-[#070a08] p-5 shadow-[0_0_30px_rgba(16,185,129,0.04)]">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400/70">
              Threat Query Matrix
            </div>
            <p className="mt-1 text-xs text-white/35">
              Filter the server-side incident dataset.
            </p>
          </div>

          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">
            PAGE {page} / {totalPages}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Status Filter
            </span>

            <select
              value={status}
              onChange={function (event) {
                handleStatusChange(
                  event.target.value as "" | IncidentStatus,
                );
              }}
              data-cursor-target="status filter"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-white outline-none transition focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20"
            >
              {STATUS_OPTIONS.map(function (option) {
                return (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[#07100c]"
                  >
                    {option.label}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Severity Filter
            </span>

            <select
              value={severity}
              onChange={function (event) {
                handleSeverityChange(event.target.value);
              }}
              data-cursor-target="severity filter"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-white outline-none transition focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20"
            >
              {SEVERITY_OPTIONS.map(function (option) {
                return (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[#07100c]"
                  >
                    {option.label}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
      </section>

      {/* Error */}
      {error && (
        <section className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">
            Query Failure
          </div>
          <p className="mt-1 text-sm text-red-200/80">{error}</p>
        </section>
      )}

      {/* Incident queue */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#070a08] shadow-[0_0_35px_rgba(0,0,0,0.3)]">
        <div className="border-b border-white/10 bg-black/20 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400/70">
                Incident Queue
              </div>
              <div className="mt-1 text-xs text-white/30">
                Live correlation output
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-white/25">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              SECURE DATA CHANNEL
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400" />
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/35">
              Loading incident telemetry...
            </p>
          </div>
        ) : incidents.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/5">
              <span className="h-3 w-3 rounded-full bg-emerald-400/60" />
            </div>

            <p className="mt-5 text-sm font-bold uppercase tracking-wider text-white/80">
              No incidents found
            </p>

            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-white/30">
              No records matched the current threat query. Change the filters
              or wait for new detections to enter the correlation pipeline.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-black/20">
                  <tr className="text-[9px] uppercase tracking-[0.2em] text-white/30">
                    <th className="px-5 py-4 text-left font-semibold">
                      Incident
                    </th>
                    <th className="px-5 py-4 text-left font-semibold">
                      Severity
                    </th>
                    <th className="px-5 py-4 text-left font-semibold">
                      Risk
                    </th>
                    <th className="px-5 py-4 text-left font-semibold">
                      Status
                    </th>
                    <th className="px-5 py-4 text-left font-semibold">
                      Operator
                    </th>
                    <th className="px-5 py-4 text-left font-semibold">
                      Updated
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {incidents.map(function (incident) {
                    const severity = severityTone(incident.severity);
                    const incidentStatus = statusTone(incident.status);
                    const risk = clampRisk(
                      Number(incident.risk_score || 0),
                    );
                    const riskMeta = riskLevel(risk);

                    return (
                      <tr
                        key={incident.id}
                        className="group transition hover:bg-emerald-500/[0.025]"
                      >
                        <td className="max-w-lg px-5 py-5 align-top">
                          <Link
                            to={"/incidents/" + incident.id}
                            data-cursor-target="incident detail"
                            className="block text-sm font-bold uppercase tracking-wide text-white transition hover:text-emerald-300"
                          >
                            {incident.title}
                          </Link>

                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/35">
                            {getExplanationSummary(incident)}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="font-mono text-[9px] uppercase tracking-wider text-white/20">
                              ID: {incident.id.slice(0, 12)}
                            </span>

                            {incident.correlation_group_id && (
                              <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/35">
                                CORR:{" "}
                                {incident.correlation_group_id.slice(0, 12)}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <span
                            className={
                              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] " +
                              severity.className
                            }
                          >
                            <span
                              className={
                                "h-1.5 w-1.5 rounded-full " +
                                severity.dotClass
                              }
                            />
                            {severity.label}
                          </span>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div className="min-w-[110px]">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-mono text-sm font-bold text-white">
                                {risk.toFixed(1)}
                              </span>

                              <span
                                className={
                                  "text-[8px] font-bold uppercase tracking-[0.15em] " +
                                  riskMeta.className
                                }
                              >
                                {riskMeta.label}
                              </span>
                            </div>

                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                              <div
                                className="h-full rounded-full bg-emerald-400 transition-all"
                                style={{
                                  width: risk + "%",
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <span
                            className={
                              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] " +
                              incidentStatus.className
                            }
                          >
                            <span
                              className={
                                "h-1.5 w-1.5 rounded-full " +
                                incidentStatus.dotClass
                              }
                            />
                            {incidentStatus.label}
                          </span>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div className="text-xs font-semibold text-white/70">
                            {incident.assigned_to ?? "Unassigned"}
                          </div>

                          <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/20">
                            Analyst
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-5 py-5 align-top">
                          <div className="text-xs text-white/50">
                            {formatDateTime(incident.updated_at)}
                          </div>

                          <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/20">
                            Last update
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-4 border-t border-white/10 bg-black/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
                  Showing page {page} of {totalPages}
                </div>

                <div className="mt-1 text-[10px] text-white/20">
                  {incidents.length} records in current tactical view
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canGoPrevious}
                  onClick={function () {
                    setPage(function (current) {
                      return Math.max(1, current - 1);
                    });
                  }}
                  data-cursor-target="previous page"
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 transition hover:border-emerald-400/30 hover:bg-emerald-500/5 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  â† Previous
                </button>

                <button
                  type="button"
                  disabled={!canGoNext}
                  onClick={function () {
                    setPage(function (current) {
                      return Math.min(totalPages, current + 1);
                    });
                  }}
                  data-cursor-target="next page"
                  className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300 transition hover:border-emerald-400/40 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  Next â†’
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Defensive analysis footer */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#070a08] p-5">
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">
            Detection Layer
          </div>

          <div className="mt-3 text-sm font-bold uppercase text-white/80">
            Rule + ML
          </div>

          <p className="mt-2 text-xs leading-5 text-white/30">
            Incidents may be produced from rule-based detections, ML anomaly
            detection, correlation, or a combination of signals.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#070a08] p-5">
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">
            Correlation
          </div>

          <div className="mt-3 text-sm font-bold uppercase text-white/80">
            Event Association
          </div>

          <p className="mt-2 text-xs leading-5 text-white/30">
            Related detections can be grouped into a single analyst-facing
            incident for investigation and response.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.025] p-5">
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-emerald-400/50">
            Platform Status
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm font-bold uppercase text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Operational
          </div>

          <p className="mt-2 text-xs leading-5 text-white/30">
            SENTINEL-X incident monitoring interface is connected to the
            authenticated API layer.
          </p>
        </div>
      </section>
    </div>
  );
}
