import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { listEvents } from "../services/eventService";
import { useWebSocket } from "../hooks/useWebSocket";
import type { WsMessage } from "../services/websocketService";

import type {
  EventRead,
  PaginatedEvents,
} from "../types/event";

import PageContainer from "../components/layout/PageContainer";

import {
  Activity,
  AlertTriangle,
  Clock3,
  Database,
  Globe2,
  Radio,
  Server,
  ShieldAlert,
  Terminal,
  Zap,
} from "lucide-react";

function asEvents(
  value:
    | EventRead[]
    | PaginatedEvents,
): EventRead[] {
  return Array.isArray(value)
    ? value
    : value.items;
}

function isEventRead(
  value: unknown,
): value is EventRead {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const event =
    value as Partial<EventRead>;

  return (
    typeof event.event_id ===
      "string" &&
    typeof event.timestamp ===
      "string" &&
    typeof event.source ===
      "string" &&
    typeof event.event_type ===
      "string" &&
    typeof event.severity ===
      "string"
  );
}

function severityMeta(
  severity: EventRead["severity"],
): {
  label: string;
  text: string;
  border: string;
  bg: string;
  dot: string;
  bar: string;
} {
  switch (severity) {
    case "critical":
      return {
        label: "CRITICAL",
        text: "text-red-300",
        border:
          "border-red-800/70",
        bg: "bg-red-500/[0.08]",
        dot: "bg-red-300",
        bar: "bg-red-300",
      };

    case "high":
      return {
        label: "HIGH",
        text: "text-orange-300",
        border:
          "border-orange-800/70",
        bg: "bg-orange-500/[0.07]",
        dot: "bg-orange-300",
        bar: "bg-orange-300",
      };

    case "medium":
      return {
        label: "MEDIUM",
        text: "text-amber-300",
        border:
          "border-amber-800/70",
        bg: "bg-amber-500/[0.07]",
        dot: "bg-amber-300",
        bar: "bg-amber-300",
      };

    case "low":
    default:
      return {
        label: "LOW",
        text: "text-emerald-300",
        border:
          "border-emerald-900/70",
        bg: "bg-emerald-500/[0.05]",
        dot: "bg-emerald-300",
        bar: "bg-emerald-300",
      };
  }
}

function sourceIcon(
  source: string,
): typeof Server {
  const normalized =
    source.toLowerCase();

  if (
    normalized.includes("dns")
  ) {
    return Globe2;
  }

  if (
    normalized.includes("auth")
  ) {
    return ShieldAlert;
  }

  if (
    normalized.includes(
      "network",
    ) ||
    normalized.includes(
      "firewall",
    )
  ) {
    return Radio;
  }

  if (
    normalized.includes(
      "endpoint",
    ) ||
    normalized.includes(
      "process",
    )
  ) {
    return Server;
  }

  return Database;
}

function shortEventType(
  eventType: string,
): string {
  return eventType
  .replace(/_/g, " ")
  .replace(/\./g, " / ")
  .toUpperCase();
}

function formatEventTime(
  timestamp: string,
): string {
  return new Date(
    timestamp,
  ).toLocaleTimeString(
    [],
    {
      hour12: false,
    },
  );
}

function EventRow({
  event,
  index,
}: {
  event: EventRead;
  index: number;
}): React.JSX.Element {
  const meta =
    severityMeta(
      event.severity,
    );

  const SourceIcon =
    sourceIcon(
      event.source,
    );

  return (
    <tr
      className="group border-b border-emerald-950/50 transition-colors hover:bg-emerald-400/[0.025]"
      style={{
        animation:
          "sentinelEventIn .28s ease-out",
        animationDelay: `${Math.min(
          index * 16,
          160,
        )}ms`,
      }}
    >
      <td className="whitespace-nowrap px-3 py-3 align-top">
        <div className="flex items-center gap-2 font-mono text-[9px] text-slate-600">
          <Clock3
            size={11}
            className="text-slate-800"
          />

          {formatEventTime(
            event.timestamp,
          )}
        </div>
      </td>

      <td className="px-3 py-3 align-top">
        <span
          className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[7px] font-bold tracking-[0.14em] ${meta.border} ${meta.bg} ${meta.text}`}
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
              size={12}
              className="text-emerald-800"
            />
          </div>

          <div className="min-w-0">
            <div className="truncate text-[9px] font-bold tracking-[0.05em] text-slate-400">
              {event.source}
            </div>

            <div className="mt-0.5 font-mono text-[7px] tracking-[0.12em] text-slate-800">
              SOURCE NODE
            </div>
          </div>
        </div>
      </td>

      <td className="max-w-[220px] px-3 py-3 align-top">
        <div className="rounded-md border border-emerald-950/70 bg-black/15 px-2 py-1.5 font-mono text-[8px] tracking-[0.1em] text-emerald-700">
          {shortEventType(
            event.event_type,
          )}
        </div>
      </td>

      <td className="max-w-[170px] px-3 py-3 align-top">
        <div className="truncate text-[9px] text-slate-500">
          {event.hostname ??
            event.source_ip ??
            "UNKNOWN NODE"}
        </div>

        {event.source_ip &&
          event.hostname && (
            <div className="mt-0.5 font-mono text-[7px] text-slate-800">
              {event.source_ip}
            </div>
          )}
      </td>

      <td className="min-w-[280px] max-w-[440px] px-3 py-3 align-top">
        <div className="text-[9px] leading-5 text-slate-500 transition-colors group-hover:text-slate-300">
          {event.message ??
            "Telemetry event received."}
        </div>

        <div className="mt-1 font-mono text-[6px] tracking-[0.14em] text-slate-900">
          ID //
          {event.event_id.slice(
            0,
            8,
          )}
        </div>
      </td>
    </tr>
  );
}

function TelemetryStat({
  label,
  value,
  code,
  icon: Icon,
}: {
  label: string;
  value: number;
  code: string;
  icon: typeof Activity;
}): React.JSX.Element {
  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-3">
      <div className="absolute right-0 top-0 h-px w-16 bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />

      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[7px] tracking-[0.18em] text-emerald-950">
            {code}
          </div>

          <div className="mt-1 text-[8px] uppercase tracking-[0.14em] text-slate-700">
            {label}
          </div>
        </div>

        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-950 bg-emerald-400/[0.035]">
          <Icon
            size={12}
            className="text-emerald-300"
          />
        </div>
      </div>

      <div className="mt-3 font-mono text-lg font-black text-white">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export default function LiveEventsPage(): React.JSX.Element {
  const [
    events,
    setEvents,
  ] = useState<EventRead[]>(
    [],
  );

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
    updatedAt,
    setUpdatedAt,
  ] = useState<Date | null>(
    null,
  );

  const [
    liveCount,
    setLiveCount,
  ] = useState(0);

  const handleWebSocketMessage =
    useCallback(
      (
        message: WsMessage,
      ): void => {
        if (
          message.type !==
          "event.created"
        ) {
          return;
        }

        if (
          !isEventRead(
            message.data,
          )
        ) {
          return;
        }

        const incomingEvent =
          message.data;

        setEvents(
          (currentEvents) => {
            if (
              currentEvents.some(
                (event) =>
                  event.event_id ===
                  incomingEvent.event_id,
              )
            ) {
              return currentEvents;
            }

            return [
              incomingEvent,
              ...currentEvents,
            ].slice(0, 50);
          },
        );

        setLiveCount(
          (count) => count + 1,
        );

        setUpdatedAt(
          new Date(),
        );

        setError(null);
      },
      [],
    );

  const {
    isConnected,
  } = useWebSocket(
    "event.created",
    handleWebSocketMessage,
  );

  useEffect(() => {
    let mounted = true;

    async function loadInitialEvents(): Promise<void> {
      try {
        const data =
          await listEvents({
            page: 1,
            size: 50,
          });

        if (!mounted) {
          return;
        }

        setEvents(
          asEvents(data).slice(
            0,
            50,
          ),
        );

        setUpdatedAt(
          new Date(),
        );

        setError(null);
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load events.",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadInitialEvents();

    return () => {
      mounted = false;
    };
  }, []);

  const severityCounts =
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

  const sourceCount =
    useMemo(
      () =>
        new Set(
          events.map(
            (event) =>
              event.source,
          ),
        ).size,
      [events],
    );

  const activeSeverity =
    events.length > 0
      ? events[0].severity
      : "low";

  const threatFeedLabel =
    activeSeverity ===
      "critical"
      ? "CRITICAL ACTIVITY"
      : activeSeverity ===
            "high"
        ? "ELEVATED ACTIVITY"
        : "MONITORED ACTIVITY";

  return (
    <PageContainer
      title="Live Events"
      subtitle="SENTINEL-X realtime telemetry // WebSocket security event stream"
    >
      <style>
        {`
          @keyframes sentinelEventIn {
            from {
              opacity: 0;
              transform: translateY(-4px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes sentinelLivePulse {
            0%,
            100% {
              opacity: .3;
            }

            50% {
              opacity: 1;
            }
          }

          @keyframes sentinelScan {
            0% {
              transform: translateY(-120%);
            }

            100% {
              transform: translateY(120%);
            }
          }

          @keyframes sentinelSignal {
            0% {
              transform: scale(.75);
              opacity: .75;
            }

            100% {
              transform: scale(2.4);
              opacity: 0;
            }
          }

          .sentinel-events-grid {
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

          .sentinel-events-scroll::-webkit-scrollbar {
            width: 7px;
            height: 7px;
          }

          .sentinel-events-scroll::-webkit-scrollbar-track {
            background: #020603;
          }

          .sentinel-events-scroll::-webkit-scrollbar-thumb {
            background: rgba(49, 96, 67, .65);
            border-radius: 999px;
          }

          .sentinel-events-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(83, 160, 110, .75);
          }
        `}
      </style>

      {error && (
        <div className="mb-4 rounded-xl border border-red-900/70 bg-red-950/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle
              size={14}
              className="text-red-300"
            />

            <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-red-400">
              TELEMETRY LINK ERROR
            </span>
          </div>

          <div className="mt-1 text-sm text-red-300">
            {error}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-2xl border border-emerald-950/90 bg-[#020603]">
          <div className="sentinel-events-grid pointer-events-none absolute inset-0" />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_50%,rgba(60,255,140,.055),transparent_22%),radial-gradient(circle_at_82%_25%,rgba(255,255,255,.025),transparent_18%)]" />

          <div
            className="pointer-events-none absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-emerald-300/[0.018] to-transparent"
            style={{
              animation:
                "sentinelScan 8s linear infinite",
            }}
          />

          <div className="relative z-10 grid gap-4 p-4 xl:grid-cols-[1.25fr_.75fr]">
            <div className="rounded-xl border border-emerald-950/80 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Terminal
                      size={15}
                      className="text-emerald-300"
                    />

                    <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-emerald-500">
                      TELEMETRY COMMAND CONSOLE
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-emerald-800/80">
                      <div className="absolute inset-2 animate-pulse rounded-full border border-emerald-400/25" />

                      <Activity
                        size={19}
                        className="text-emerald-200"
                      />

                      <span className="absolute -right-0.5 top-1 h-1.5 w-1.5 rounded-full bg-white" />
                    </div>

                    <div>
                      <div className="text-xl font-black tracking-tight text-white">
                        REALTIME EVENT FABRIC
                      </div>

                      <div className="mt-1 font-mono text-[8px] tracking-[0.16em] text-slate-700">
                        {threatFeedLabel}
                        {" // "}
                        {events.length} VISIBLE
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                    isConnected
                      ? "border-emerald-800/70 bg-emerald-950/20"
                      : "border-red-900/70 bg-red-950/20"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    {isConnected && (
                      <span
                        className="absolute inset-0 rounded-full bg-emerald-300"
                        style={{
                          animation:
                            "sentinelSignal 1.6s ease-out infinite",
                        }}
                      />
                    )}

                    <span
                      className={`relative h-2 w-2 rounded-full ${
                        isConnected
                          ? "bg-emerald-300"
                          : "bg-red-400"
                      }`}
                    />
                  </span>

                  {isConnected ? (
                    <Radio
                      size={12}
                      className="text-emerald-300"
                    />
                  ) : (
                    <Radio
                      size={12}
                      className="text-red-300"
                    />
                  )}

                  <div>
                    <div
                      className={`font-mono text-[8px] font-bold tracking-[0.18em] ${
                        isConnected
                          ? "text-emerald-300"
                          : "text-red-300"
                      }`}
                    >
                      {isConnected
                        ? "WEBSOCKET LIVE"
                        : "CONNECTING"}
                    </div>

                    <div className="mt-0.5 font-mono text-[7px] tracking-[0.14em] text-slate-700">
                      EVENT.CREATED
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <TelemetryStat
                  label="Visible Events"
                  value={
                    events.length
                  }
                  code="EVT"
                  icon={Activity}
                />

                <TelemetryStat
                  label="Live Received"
                  value={
                    liveCount
                  }
                  code="LIVE"
                  icon={Zap}
                />

                <TelemetryStat
                  label="Sources"
                  value={
                    sourceCount
                  }
                  code="SRC"
                  icon={Server}
                />

                <TelemetryStat
                  label="Critical"
                  value={
                    severityCounts.critical
                  }
                  code="CRT"
                  icon={
                    AlertTriangle
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-emerald-950/80 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-[8px] tracking-[0.18em] text-emerald-700">
                    THREAT DISTRIBUTION
                  </div>

                  <div className="mt-1 text-sm font-bold text-white">
                    Current Stream
                  </div>
                </div>

                <ShieldAlert
                  size={16}
                  className="text-emerald-800"
                />
              </div>

              <div className="mt-5 space-y-3">
                {[
                  {
                    label: "Critical",
                    value:
                      severityCounts.critical,
                    color:
                      "bg-red-300",
                    text:
                      "text-red-300",
                  },
                  {
                    label: "High",
                    value:
                      severityCounts.high,
                    color:
                      "bg-orange-300",
                    text:
                      "text-orange-300",
                  },
                  {
                    label: "Medium",
                    value:
                      severityCounts.medium,
                    color:
                      "bg-amber-300",
                    text:
                      "text-amber-300",
                  },
                  {
                    label: "Low",
                    value:
                      severityCounts.low,
                    color:
                      "bg-emerald-300",
                    text:
                      "text-emerald-300",
                  },
                ].map(
                  ({
                    label,
                    value,
                    color,
                    text,
                  }) => {
                    const percentage =
                      events.length >
                      0
                        ? Math.max(
                            5,
                            (
                              value /
                              events.length
                            ) *
                              100,
                          )
                        : 0;

                    return (
                      <div
                        key={label}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-slate-600">
                            {label}
                          </span>

                          <span
                            className={`font-mono text-[8px] font-bold ${text}`}
                          >
                            {value}
                          </span>
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-emerald-950/70">
                          <div
                            className={`h-full rounded-full ${color}`}
                            style={{
                              width: `${Math.min(
                                100,
                                percentage,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-md border border-emerald-950 bg-black/20 px-3 py-2">
                  <div className="font-mono text-[7px] tracking-[0.15em] text-slate-800">
                    UPDATED
                  </div>

                  <div className="mt-1 font-mono text-[9px] text-emerald-300">
                    {updatedAt
                      ? updatedAt.toLocaleTimeString(
                          [],
                          {
                            hour12:
                              false,
                          },
                        )
                      : "--:--:--"}
                  </div>
                </div>

                <div className="rounded-md border border-emerald-950 bg-black/20 px-3 py-2">
                  <div className="font-mono text-[7px] tracking-[0.15em] text-slate-800">
                    BUFFER
                  </div>

                  <div className="mt-1 font-mono text-[9px] text-emerald-300">
                    {events.length}/50
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-emerald-950/90 bg-[#030704]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-950/80 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-950 bg-emerald-400/[0.035]">
                <Radio
                  size={14}
                  className="text-emerald-300"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-white">
                    EVENT STREAM
                  </span>

                  <span className="h-1 w-1 rounded-full bg-emerald-300" />

                  <span className="font-mono text-[7px] tracking-[0.15em] text-emerald-800">
                    LIVE BUFFER
                  </span>
                </div>

                <div className="mt-0.5 text-[8px] text-slate-700">
                  Newest telemetry appears at the top.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 font-mono text-[7px] tracking-[0.16em] text-slate-800 sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                STREAMING
              </div>

              <div className="rounded-md border border-emerald-950 bg-black/20 px-2 py-1 font-mono text-[7px] tracking-[0.14em] text-emerald-800">
                MAX 50
              </div>
            </div>
          </div>

          <div className="sentinel-events-scroll overflow-auto">
            <table className="min-w-[1080px] text-left">
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
                    Host / IP
                  </th>

                  <th className="px-3 py-3">
                    Message / Telemetry
                  </th>
                </tr>
              </thead>

              <tbody>
                {events.map(
                  (
                    event,
                    index,
                  ) => (
                    <EventRow
                      key={
                        event.event_id
                      }
                      event={
                        event
                      }
                      index={
                        index
                      }
                    />
                  ),
                )}
              </tbody>
            </table>

            {!loading &&
              events.length ===
                0 && (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-emerald-900/70">
                    <div className="absolute inset-1 animate-pulse rounded-full border border-emerald-400/15" />

                    <Radio
                      size={20}
                      className="text-emerald-900"
                    />
                  </div>

                  <div className="mt-4 font-mono text-[10px] font-bold tracking-[0.18em] text-slate-600">
                    NO TELEMETRY IN BUFFER
                  </div>

                  <div className="mt-1 max-w-md text-[9px] leading-5 text-slate-800">
                    Waiting for SENTINEL-X event
                    ingestion and realtime
                    WebSocket telemetry.
                  </div>
                </div>
              )}

            {loading && (
              <div className="flex items-center justify-center gap-3 px-4 py-10 font-mono text-[9px] tracking-[0.18em] text-emerald-700">
                <div className="h-4 w-4 animate-spin rounded-full border border-emerald-800 border-t-emerald-200" />
                LOADING TELEMETRY BUFFER...
              </div>
            )}
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
                GLOBAL FABRIC
              </span>
            </div>

            <p className="mt-2 text-[9px] leading-5 text-slate-700">
              Events are ingested from the active
              Sentinel-X telemetry network and
              normalized for downstream detection.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-4">
            <div className="flex items-center gap-2">
              <Zap
                size={14}
                className="text-emerald-300"
              />

              <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-white">
                REALTIME PIPE
              </span>
            </div>

            <p className="mt-2 text-[9px] leading-5 text-slate-700">
              WebSocket event.created messages are
              inserted into the live buffer and
              deduplicated by event identifier.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-4">
            <div className="flex items-center gap-2">
              <Terminal
                size={14}
                className="text-emerald-300"
              />

              <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-white">
                DEFENSIVE MODE
              </span>
            </div>

            <p className="mt-2 text-[9px] leading-5 text-slate-700">
              Live Events is a monitoring surface.
              Detection, correlation and response
              remain handled by the backend pipeline.
            </p>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}