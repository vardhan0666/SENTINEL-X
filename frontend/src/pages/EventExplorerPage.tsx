import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  FormEvent,
  JSX,
} from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clock3,
  Database,
  Filter,
  Globe2,
  Radio,
  RotateCcw,
  Search,
  ShieldAlert,
  Terminal,
  UserRound,
  X,
} from "lucide-react";

import { listEvents } from "../services/eventService";
import type {
  EventRead,
  EventListResponse,
  Severity,
} from "../types/event";
import PageContainer from "../components/layout/PageContainer";

type EventListLike =
  EventListResponse & {
    items?: EventRead[];
    total?: number;
    pages?: number;
    page?: number;
    size?: number;
    limit?: number;
    offset?: number;
    count?: number;
  };

function asEvents(
  value: EventListResponse,
): EventRead[] {
  if (Array.isArray(value)) {
    return value;
  }

  const response =
    value as EventListLike;

  if (
    Array.isArray(
      response.items,
    )
  ) {
    return response.items;
  }

  return [];
}

function calculatePages(
  value: EventListResponse,
  pageSize: number,
): number {
  if (Array.isArray(value)) {
    return 1;
  }

  const response =
    value as EventListLike;

  if (
    typeof response.pages ===
      "number" &&
    Number.isFinite(
      response.pages,
    ) &&
    response.pages > 0
  ) {
    return Math.max(
      1,
      Math.ceil(
        response.pages,
      ),
    );
  }

  const totalCandidates = [
    response.total,
    response.count,
  ];

  const total =
    totalCandidates.find(
      (item) =>
        typeof item ===
          "number" &&
        Number.isFinite(
          item,
        ) &&
        item >= 0,
    );

  const effectivePageSize =
    typeof response.size ===
        "number" &&
      Number.isFinite(
        response.size,
      ) &&
      response.size > 0
      ? response.size
      : typeof response.limit ===
            "number" &&
          Number.isFinite(
            response.limit,
          ) &&
          response.limit > 0
        ? response.limit
        : pageSize;

  if (
    typeof total ===
    "number"
  ) {
    return Math.max(
      1,
      Math.ceil(
        total /
          effectivePageSize,
      ),
    );
  }

  return 1;
}

function displayValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

function formatDateTime(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    [],
    {
      hour12: false,
    },
  );
}

function formatTimeOnly(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "--:--:--";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour12: false,
    },
  );
}

function severityMeta(
  severity: Severity,
): {
  label: string;
  text: string;
  border: string;
  bg: string;
  dot: string;
} {
  switch (
    severity
  ) {
    case "critical":
      return {
        label: "CRITICAL",
        text: "text-red-300",
        border:
          "border-red-800/70",
        bg: "bg-red-500/[0.08]",
        dot: "bg-red-300",
      };

    case "high":
      return {
        label: "HIGH",
        text: "text-orange-300",
        border:
          "border-orange-800/70",
        bg: "bg-orange-500/[0.08]",
        dot: "bg-orange-300",
      };

    case "medium":
      return {
        label: "MEDIUM",
        text: "text-amber-300",
        border:
          "border-amber-800/70",
        bg: "bg-amber-500/[0.07]",
        dot: "bg-amber-300",
      };

    case "low":
      return {
        label: "LOW",
        text: "text-emerald-300",
        border:
          "border-emerald-900/70",
        bg: "bg-emerald-500/[0.05]",
        dot: "bg-emerald-300",
      };

    default:
      return {
        label:
          String(
            severity,
          ).toUpperCase(),
        text: "text-slate-400",
        border:
          "border-slate-800",
        bg: "bg-slate-900/40",
        dot: "bg-slate-500",
      };
  }
}

function sourceIcon(
  source: string,
): typeof ServerIcon {
  const normalized =
    source.toLowerCase();

  if (
    normalized.includes(
      "dns",
    )
  ) {
    return GlobeIcon;
  }

  if (
    normalized.includes(
      "auth",
    )
  )
    return ShieldIcon;

  if (
    normalized.includes(
        "network",
      ) ||
    normalized.includes(
      "firewall",
    )
  ) {
    return RadioIcon;
  }

  return ServerIcon;
}

function SourceIcon({
  source,
}: {
  source: string;
}): JSX.Element {
  const Icon =
    sourceIcon(source);

  return (
    <Icon
      size={13}
      className="text-emerald-300"
      aria-hidden="true"
    />
  );
}

function ServerIcon(
  props: {
    size?: number;
    className?: string;
  },
): JSX.Element {
  return (
    <Database
      {...props}
    />
  );
}

function GlobeIcon(
  props: {
    size?: number;
    className?: string;
  },
): JSX.Element {
  return (
    <Globe2
      {...props}
    />
  );
}

function ShieldIcon(
  props: {
    size?: number;
    className?: string;
  },
): JSX.Element {
  return (
    <ShieldAlert
      {...props}
    />
  );
}

function RadioIcon(
  props: {
    size?: number;
    className?: string;
  },
): JSX.Element {
  return (
    <Radio
      {...props}
    />
  );
}

function ExplorerStat({
  label,
  value,
  icon: Icon,
  code,
}: {
  label: string;
  value: number | string;
  icon: typeof Activity;
  code: string;
}): JSX.Element {
  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-3">
      <div className="absolute right-0 top-0 h-px w-16 bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />

      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[7px] tracking-[0.2em] text-emerald-950">
            {code}
          </div>

          <div className="mt-1 text-[8px] uppercase tracking-[0.13em] text-slate-700">
            {label}
          </div>
        </div>

        <div className="rounded-md border border-emerald-950 bg-emerald-400/[0.035] p-1.5">
          <Icon
            size={12}
            className="text-emerald-300"
          />
        </div>
      </div>

      <div className="mt-3 font-mono text-lg font-black text-white">
        {typeof value ===
        "number"
          ? value.toLocaleString()
          : value}
      </div>
    </div>
  );
}

function EventExplorerRow({
  event,
  index,
}: {
  event: EventRead;
  index: number;
}): JSX.Element {
  const meta =
    severityMeta(
      event.severity,
    );

  return (
    <tr
      className="group border-b border-emerald-950/50 transition-all duration-200 hover:bg-emerald-400/[0.025]"
      style={{
        animation:
          "sentinelExplorerRow .25s ease-out",
        animationDelay: `${Math.min(
          index * 15,
          180,
        )}ms`,
      }}
    >
      <td className="whitespace-nowrap px-3 py-3 align-top">
        <div className="flex items-center gap-2">
          <Clock3
            size={11}
            className="text-slate-800"
          />

          <div>
            <div className="font-mono text-[9px] text-slate-500">
              {formatTimeOnly(
                event.timestamp,
              )}
            </div>

            <div className="mt-0.5 font-mono text-[7px] text-slate-900">
              {formatDateTime(
                event.timestamp,
              )}
            </div>
          </div>
        </div>
      </td>

      <td className="px-3 py-3 align-top">
        <span
          className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[7px] font-bold tracking-[0.13em] ${meta.border} ${meta.bg} ${meta.text}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
          />

          {meta.label}
        </span>
      </td>

      <td className="px-3 py-3 align-top">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-950 bg-black/20">
            <SourceIcon
              source={
                event.source
              }
            />
          </div>

          <div className="min-w-0">
            <div className="max-w-[150px] truncate text-[9px] font-bold text-slate-400">
              {displayValue(
                event.source,
              )}
            </div>

            <div className="mt-0.5 font-mono text-[6px] tracking-[0.15em] text-slate-900">
              SOURCE NODE
            </div>
          </div>
        </div>
      </td>

      <td className="max-w-[235px] px-3 py-3 align-top">
        <div className="rounded-md border border-emerald-950/70 bg-black/15 px-2 py-1.5 font-mono text-[8px] tracking-[0.08em] text-emerald-700">
          {displayValue(
            event.event_type,
          )}
        </div>
      </td>

      <td className="px-3 py-3 align-top">
        <div className="flex items-center gap-2">
          <UserRound
            size={11}
            className="text-slate-800"
          />

          <span className="max-w-[130px] truncate text-[9px] text-slate-500">
            {displayValue(
              event.username,
            )}
          </span>
        </div>
      </td>

      <td className="px-3 py-3 align-top">
        <div className="font-mono text-[8px] text-slate-500">
          {displayValue(
            event.source_ip,
          )}
        </div>
      </td>

      <td className="min-w-[270px] max-w-[400px] px-3 py-3 align-top">
        <div className="text-[9px] leading-5 text-slate-500 transition-colors group-hover:text-slate-300">
          {displayValue(
            event.message,
          )}
        </div>

        <div className="mt-1 font-mono text-[6px] tracking-[0.14em] text-slate-900">
          EVENT //
          {event.event_id
            ? event.event_id.slice(
                0,
                12,
              )
            : "UNKNOWN"}
        </div>
      </td>
    </tr>
  );
}

export default function EventExplorerPage(): JSX.Element {
  const [
    severity,
    setSeverity,
  ] = useState("");

  const [
    source,
    setSource,
  ] = useState("");

  const [
    eventType,
    setEventType,
  ] = useState("");

  const [
    events,
    setEvents,
  ] = useState<EventRead[]>(
    [],
  );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pages,
    setPages,
  ] = useState(1);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState<Date | null>(
    null,
  );

  const pageSize = 50;

  const load = useCallback(
    async (
      targetPage: number,
    ): Promise<void> => {
      setLoading(true);

      try {
        const data =
          await listEvents({
            page:
              targetPage,
            size:
              pageSize,
            severity:
              severity ||
              undefined,
            source:
              source ||
              undefined,
            event_type:
              eventType ||
              undefined,
          });

        const normalizedEvents =
          asEvents(data);

        const totalPages =
          calculatePages(
            data,
            pageSize,
          );

        const safePage =
          Math.min(
            Math.max(
              1,
              targetPage,
            ),
            totalPages,
          );

        setEvents(
          normalizedEvents,
        );

        setPage(
          safePage,
        );

        setPages(
          totalPages,
        );

        setLastUpdated(
          new Date(),
        );

        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load events.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      eventType,
      severity,
      source,
    ],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();
    void load(1);
  }

  function handleReset(): void {
    setSeverity("");
    setSource("");
    setEventType("");
  }

  const pageSeverityCounts =
    useMemo(() => {
      return events.reduce(
        (
          counts,
          event,
        ) => {
          counts[
            event.severity
          ] += 1;

          return counts;
        },
        {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        } as Record<
          string,
          number
        >,
      );
    }, [events]);

  const activeFilters =
    [
      severity
        ? `SEVERITY:${severity}`
        : null,
      source
        ? `SOURCE:${source}`
        : null,
      eventType
        ? `TYPE:${eventType}`
        : null,
    ].filter(
      (
        value,
      ): value is string =>
        Boolean(value),
    );

  return (
    <PageContainer
      title="Event Explorer"
      subtitle="SENTINEL-X threat hunting console // normalized telemetry investigation"
    >
      <style>
        {`
          @keyframes sentinelExplorerRow {
            from {
              opacity: 0;
              transform: translateY(-3px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes sentinelExplorerPulse {
            0%,
            100% {
              opacity: .25;
            }

            50% {
              opacity: 1;
            }
          }

          @keyframes sentinelExplorerScan {
            0% {
              transform: translateY(-120%);
            }

            100% {
              transform: translateY(120%);
            }
          }

          .sentinel-explorer-grid {
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

          .sentinel-explorer-scroll::-webkit-scrollbar {
            width: 7px;
            height: 7px;
          }

          .sentinel-explorer-scroll::-webkit-scrollbar-track {
            background: #020603;
          }

          .sentinel-explorer-scroll::-webkit-scrollbar-thumb {
            background: rgba(49,96,67,.7);
            border-radius: 999px;
          }
        `}
      </style>

      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-2xl border border-emerald-950/90 bg-[#020603]">
          <div className="sentinel-explorer-grid pointer-events-none absolute inset-0" />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(60,255,140,.05),transparent_25%),radial-gradient(circle_at_78%_20%,rgba(255,255,255,.025),transparent_20%)]" />

          <div
            className="pointer-events-none absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-emerald-300/[0.018] to-transparent"
            style={{
              animation:
                "sentinelExplorerScan 8s linear infinite",
            }}
          />

          <div className="relative z-10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Search
                    size={16}
                    className="text-emerald-300"
                  />

                  <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-emerald-500">
                    THREAT HUNTING CONSOLE
                  </span>
                </div>

                <div className="mt-2 text-xl font-black tracking-tight text-white">
                  EVENT INTELLIGENCE MATRIX
                </div>

                <div className="mt-1 max-w-2xl text-[9px] leading-5 text-slate-600">
                  Query normalized security telemetry by
                  severity, source and event type without
                  changing the underlying backend event pipeline.
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-emerald-900/70 bg-emerald-950/15 px-3 py-2">
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inset-0 rounded-full bg-emerald-300"
                    style={{
                      animation:
                        "sentinelExplorerPulse 1.5s ease-in-out infinite",
                    }}
                  />

                  <span className="relative h-2 w-2 rounded-full bg-emerald-300" />
                </span>

                <div>
                  <div className="font-mono text-[8px] font-bold tracking-[0.17em] text-emerald-300">
                    QUERY ENGINE READY
                  </div>

                  <div className="mt-0.5 font-mono text-[7px] tracking-[0.14em] text-slate-700">
                    SERVER-SIDE FILTERING
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <ExplorerStat
                label="Visible Events"
                value={
                  events.length
                }
                icon={Activity}
                code="EVT"
              />

              <ExplorerStat
                label="Critical"
                value={
                  pageSeverityCounts.critical
                }
                icon={
                  ShieldAlert
                }
                code="CRT"
              />

              <ExplorerStat
                label="Sources"
                value={
                  new Set(
                    events.map(
                      (
                        event,
                      ) =>
                        event.source,
                    ),
                  ).size
                }
                icon={Database}
                code="SRC"
              />

              <ExplorerStat
                label="Current Page"
                value={`${page}/${pages}`}
                icon={
                  BarChart3
                }
                code="PAGE"
              />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-emerald-950/90 bg-[#030704]">
          <div className="border-b border-emerald-950/80 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter
                  size={14}
                  className="text-emerald-300"
                />

                <div>
                  <div className="font-mono text-[9px] font-bold tracking-[0.18em] text-white">
                    QUERY PARAMETERS
                  </div>

                  <div className="mt-0.5 text-[8px] text-slate-700">
                    Refine the telemetry dataset
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {lastUpdated && (
                  <span className="hidden font-mono text-[7px] tracking-[0.14em] text-slate-800 sm:inline">
                    SYNC{" "}
                    {lastUpdated.toLocaleTimeString(
                      [],
                      {
                        hour12:
                          false,
                      },
                    )}
                  </span>
                )}

                {activeFilters.length >
                  0 && (
                  <button
                    type="button"
                    onClick={
                      handleReset
                    }
                    data-cursor-target
                    className="flex items-center gap-1.5 rounded-md border border-emerald-950 px-2 py-1 font-mono text-[7px] tracking-[0.13em] text-slate-600 transition hover:border-emerald-800 hover:text-emerald-300"
                  >
                    <RotateCcw
                      size={10}
                    />
                    RESET
                  </button>
                )}
              </div>
            </div>
          </div>

          <form
            onSubmit={
              handleSubmit
            }
            className="grid gap-3 p-4 lg:grid-cols-[.75fr_1fr_1fr_auto]"
          >
            <label className="block">
              <span className="font-mono text-[7px] font-bold tracking-[0.18em] text-slate-700">
                SEVERITY
              </span>

              <select
                value={severity}
                onChange={(
                  event,
                ) =>
                  setSeverity(
                    event.target
                      .value,
                  )
                }
                data-cursor-target
                className="mt-2 w-full rounded-lg border border-emerald-950 bg-black/30 px-3 py-2.5 text-[10px] text-slate-300 outline-none transition focus:border-emerald-700/80 focus:bg-emerald-950/10"
              >
                <option value="">
                  All severities
                </option>

                <option value="low">
                  Low
                </option>

                <option value="medium">
                  Medium
                </option>

                <option value="high">
                  High
                </option>

                <option value="critical">
                  Critical
                </option>
              </select>
            </label>

            <label className="block">
              <span className="font-mono text-[7px] font-bold tracking-[0.18em] text-slate-700">
                SOURCE NODE
              </span>

              <div className="relative mt-2">
                <Database
                  size={12}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-900"
                />

                <input
                  value={source}
                  onChange={(
                    event,
                  ) =>
                    setSource(
                      event.target
                        .value,
                    )
                  }
                  data-cursor-target
                  className="w-full rounded-lg border border-emerald-950 bg-black/30 py-2.5 pl-8 pr-3 text-[10px] text-slate-300 outline-none transition placeholder:text-slate-800 focus:border-emerald-700/80 focus:bg-emerald-950/10"
                  placeholder="windows-ad"
                />
              </div>
            </label>

            <label className="block">
              <span className="font-mono text-[7px] font-bold tracking-[0.18em] text-slate-700">
                EVENT TYPE
              </span>

              <div className="relative mt-2">
                <Terminal
                  size={12}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-900"
                />

                <input
                  value={eventType}
                  onChange={(
                    event,
                  ) =>
                    setEventType(
                      event.target
                        .value,
                    )
                  }
                  data-cursor-target
                  className="w-full rounded-lg border border-emerald-950 bg-black/30 py-2.5 pl-8 pr-3 font-mono text-[10px] text-slate-300 outline-none transition placeholder:text-slate-800 focus:border-emerald-700/80 focus:bg-emerald-950/10"
                  placeholder="authentication.failure"
                />
              </div>
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={
                  loading
                }
                data-cursor-target
                className="group relative flex h-[39px] w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-emerald-700/60 bg-emerald-400/[0.06] px-4 font-mono text-[8px] font-bold tracking-[0.16em] text-emerald-100 transition-all duration-300 hover:border-emerald-300 hover:bg-emerald-400/[0.1] hover:shadow-[0_0_28px_rgba(70,255,145,.08)] disabled:cursor-not-allowed disabled:opacity-40 lg:min-w-[145px]"
              >
                <span className="absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-700 group-hover:translate-x-[400%]" />

                {loading ? (
                  <>
                    <RotateCcw
                      size={12}
                      className="animate-spin"
                    />

                    QUERYING
                  </>
                ) : (
                  <>
                    <Search
                      size={12}
                    />

                    EXECUTE QUERY
                  </>
                )}
              </button>
            </div>
          </form>

          {activeFilters.length >
            0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-emerald-950/60 px-4 py-3">
              <span className="font-mono text-[7px] tracking-[0.16em] text-slate-800">
                ACTIVE FILTERS
              </span>

              {activeFilters.map(
                (
                  filter,
                ) => (
                  <span
                    key={filter}
                    className="flex items-center gap-1.5 rounded-md border border-emerald-950 bg-emerald-400/[0.03] px-2 py-1 font-mono text-[7px] tracking-[0.1em] text-emerald-700"
                  >
                    <span className="h-1 w-1 rounded-full bg-emerald-300" />

                    {filter}

                    <X
                      size={9}
                      className="text-emerald-950"
                    />
                  </span>
                ),
              )}
            </div>
          )}
        </section>

        {error && (
          <section className="rounded-xl border border-red-900/70 bg-red-950/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldAlert
                size={13}
                className="text-red-300"
              />

              <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-red-400">
                QUERY ENGINE ERROR
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
                <Activity
                  size={14}
                  className="text-emerald-300"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-white">
                    TELEMETRY DATASET
                  </span>

                  <span className="h-1 w-1 rounded-full bg-emerald-300" />

                  <span className="font-mono text-[7px] tracking-[0.15em] text-emerald-800">
                    PAGE {page} /{" "}
                    {pages}
                  </span>
                </div>

                <div className="mt-0.5 text-[8px] text-slate-700">
                  {loading
                    ? "Retrieving normalized events..."
                    : `${events.length} events returned from query`}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-md border border-emerald-950 bg-black/20 px-2 py-1.5 sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />

                <span className="font-mono text-[7px] tracking-[0.14em] text-emerald-800">
                  INDEX READY
                </span>
              </div>

              <div className="rounded-md border border-emerald-950 bg-black/20 px-2 py-1.5 font-mono text-[7px] tracking-[0.14em] text-slate-700">
                LIMIT{" "}
                {pageSize}
              </div>
            </div>
          </div>

          <div className="sentinel-explorer-scroll overflow-auto">
            <table className="min-w-[1250px] text-left">
              <thead className="border-b border-emerald-950/70 bg-black/20">
                <tr className="font-mono text-[7px] uppercase tracking-[0.16em] text-slate-700">
                  <th className="px-3 py-3">
                    Time
                  </th>

                  <th className="px-3 py-3">
                    Severity
                  </th>

                  <th className="px-3 py-3">
                    Source
                  </th>

                  <th className="px-3 py-3">
                    Event Type
                  </th>

                  <th className="px-3 py-3">
                    User
                  </th>

                  <th className="px-3 py-3">
                    Source IP
                  </th>

                  <th className="px-3 py-3">
                    Event Message
                  </th>
                </tr>
              </thead>

              <tbody>
                {events.map(
                  (
                    event,
                    index,
                  ) => (
                    <EventExplorerRow
                      key={
                        event.event_id ??
                        `${event.timestamp}-${index}`
                      }
                      event={event}
                      index={
                        index
                      }
                    />
                  ),
                )}
              </tbody>
            </table>

            {loading && (
              <div className="flex items-center justify-center gap-3 px-4 py-12 font-mono text-[8px] tracking-[0.18em] text-emerald-700">
                <div className="h-4 w-4 animate-spin rounded-full border border-emerald-800 border-t-emerald-200" />

                ACCESSING TELEMETRY INDEX...
              </div>
            )}

            {!loading &&
              events.length ===
                0 && (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-emerald-900/70">
                    <div className="absolute inset-1 animate-pulse rounded-full border border-emerald-400/15" />

                    <Search
                      size={20}
                      className="text-emerald-900"
                    />
                  </div>

                  <div className="mt-4 font-mono text-[9px] font-bold tracking-[0.18em] text-slate-600">
                    NO MATCHING TELEMETRY
                  </div>

                  <div className="mt-1 max-w-md text-[9px] leading-5 text-slate-800">
                    The current query returned no
                    events. Adjust the parameters
                    and execute the query again.
                  </div>
                </div>
              )}
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-3">
          <div className="flex items-center gap-2">
            <BarChart3
              size={13}
              className="text-emerald-800"
            />

            <span className="font-mono text-[8px] tracking-[0.16em] text-slate-700">
              DATASET NAVIGATION
            </span>

            <span className="hidden text-[8px] text-slate-900 sm:inline">
              //
            </span>

            <span className="hidden font-mono text-[7px] tracking-[0.12em] text-slate-800 sm:inline">
              SERVER PAGINATION
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={
                page <= 1 ||
                loading
              }
              onClick={() =>
                void load(
                  page - 1,
                )
              }
              data-cursor-target
              className="group flex items-center gap-2 rounded-lg border border-emerald-950 bg-black/20 px-3 py-2 font-mono text-[7px] font-bold tracking-[0.14em] text-slate-500 transition hover:border-emerald-800 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowLeft
                size={12}
                className="transition-transform group-hover:-translate-x-0.5"
              />

              PREVIOUS
            </button>

            <div className="rounded-lg border border-emerald-900/70 bg-emerald-400/[0.035] px-4 py-2 text-center">
              <div className="font-mono text-[7px] tracking-[0.15em] text-slate-800">
                QUERY PAGE
              </div>

              <div className="mt-0.5 font-mono text-[10px] font-bold text-emerald-300">
                {page}{" "}
                <span className="text-emerald-900">
                  /
                </span>{" "}
                {pages}
              </div>
            </div>

            <button
              type="button"
              disabled={
                page >= pages ||
                loading
              }
              onClick={() =>
                void load(
                  page + 1,
                )
              }
              data-cursor-target
              className="group flex items-center gap-2 rounded-lg border border-emerald-950 bg-black/20 px-3 py-2 font-mono text-[7px] font-bold tracking-[0.14em] text-slate-500 transition hover:border-emerald-800 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              NEXT

              <ArrowRight
                size={12}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-4">
            <div className="flex items-center gap-2">
              <Globe2
                size={14}
                className="text-emerald-300"
              />

              <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-white">
                NORMALIZED DATA
              </span>
            </div>

            <p className="mt-2 text-[9px] leading-5 text-slate-700">
              Events displayed here are normalized
              telemetry records returned by the SENTINEL-X
              event service.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-4">
            <div className="flex items-center gap-2">
              <Terminal
                size={14}
                className="text-emerald-300"
              />

              <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-white">
                HUNTING WORKFLOW
              </span>
            </div>

            <p className="mt-2 text-[9px] leading-5 text-slate-700">
              Select parameters, execute the server-side
              query, inspect the resulting telemetry and
              navigate the dataset page by page.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-4">
            <div className="flex items-center gap-2">
              <Radio
                size={14}
                className="text-emerald-300"
              />

              <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-white">
                DEFENSIVE ANALYSIS
              </span>
            </div>

            <p className="mt-2 text-[9px] leading-5 text-slate-700">
              Investigation remains read-only from this
              console. Detection and defensive response are
              handled by the existing Sentinel-X services.
            </p>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}