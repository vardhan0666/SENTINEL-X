import { useEffect, useState } from "react";
import PageContainer from "../components/layout/PageContainer";
import {
  getDetectionTypes,
} from "../services/analyticsService";
import type {
  DetectionTypeDistributionItem,
} from "../types/analytics";
import EventsOverTimeChart from "../components/charts/EventsOverTimeChart";
import SeverityDistributionChart from "../components/charts/SeverityDistributionChart";
import TopSourcesChart from "../components/charts/TopSourcesChart";

function percentageFor(
  count: number,
  total: number,
): number {
  if (total <= 0) {
    return 0;
  }

  return (count / total) * 100;
}

function percentageWidth(
  count: number,
  total: number,
): number {
  return Math.min(
    100,
    Math.max(0, percentageFor(count, total)),
  );
}

function typeTone(
  detectionType: string,
): {
  border: string;
  bg: string;
  text: string;
  dot: string;
} {
  const normalized = detectionType.toLowerCase();

  if (
    normalized.includes("anomaly") ||
    normalized.includes("ml")
  ) {
    return {
      border: "border-purple-500/20",
      bg: "bg-purple-500/5",
      text: "text-purple-300",
      dot: "bg-purple-400",
    };
  }

  if (
    normalized.includes("auth") ||
    normalized.includes("login")
  ) {
    return {
      border: "border-orange-500/20",
      bg: "bg-orange-500/5",
      text: "text-orange-300",
      dot: "bg-orange-400",
    };
  }

  if (
    normalized.includes("network") ||
    normalized.includes("dns")
  ) {
    return {
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
      text: "text-emerald-300",
      dot: "bg-emerald-400",
    };
  }

  return {
    border: "border-white/10",
    bg: "bg-white/[0.025]",
    text: "text-white/65",
    dot: "bg-white/35",
  };
}

export default function AnalyticsPage(): React.JSX.Element {
  const [detectionTypes, setDetectionTypes] =
    useState<DetectionTypeDistributionItem[]>(
      [],
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDetectionTypes(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const result = await getDetectionTypes(
          controller.signal,
        );

        setDetectionTypes(result);
      } catch (err) {
        if (
          err instanceof Error &&
          err.name === "AbortError"
        ) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load detection analytics.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDetectionTypes();

    return () => {
      controller.abort();
    };
  }, []);

  const totalDetections = detectionTypes.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  const topDetection =
    detectionTypes.length > 0
      ? detectionTypes.reduce(
          (
            current,
            item,
          ) =>
            item.count > current.count
              ? item
              : current,
        )
      : null;

  const detectionTypeCount =
    detectionTypes.length;

  return (
    <PageContainer
      title="Analytics"
      subtitle="Aggregated telemetry and detection intelligence"
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

          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border border-emerald-400/10" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-400/70">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                SOC Intelligence Matrix
              </div>

              <h1 className="text-3xl font-black uppercase tracking-[0.08em] text-white">
                Threat Analytics
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/40">
                Aggregated telemetry, severity distribution, source activity,
                detection behavior, and threat trends from the SENTINEL-X
                backend.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <AnalyticsMetric
                label="Detections"
                value={totalDetections.toLocaleString()}
                detail="Total signals"
              />

              <AnalyticsMetric
                label="Classes"
                value={detectionTypeCount.toLocaleString()}
                detail="Detection types"
              />

              <AnalyticsMetric
                label="Top Signal"
                value={
                  topDetection
                    ? topDetection.count.toLocaleString()
                    : "0"
                }
                detail={
                  topDetection
                    ? topDetection.detection_type
                    : "No data"
                }
              />
            </div>
          </div>
        </section>

        {/* Query state */}
        {error && (
          <section className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-400" />

              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-red-300">
                  Analytics Query Failure
                </div>

                <p className="mt-2 text-sm leading-6 text-red-200/70">
                  {error}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Chart matrix */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/60">
                Telemetry Visualization Matrix
              </div>

              <div className="mt-1 text-xs text-white/25">
                Real backend analytics rendered through the SOC chart layer.
              </div>
            </div>

            <div className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/20 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              DATA LINK ACTIVE
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartShell
              code="ANALYTICS-01"
              title="Events Over Time"
              description="Hourly event volume over the last 24 hours."
            >
              <EventsOverTimeChart
                params={{
                  hours: 24,
                  bucket_minutes: 60,
                }}
              />
            </ChartShell>

            <ChartShell
              code="ANALYTICS-02"
              title="Severity Distribution"
              description="Current event severity composition."
            >
              <SeverityDistributionChart />
            </ChartShell>
          </div>
        </section>

        {/* Source + detection matrix */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/60">
                Threat Origin Analysis
              </div>

              <div className="mt-1 text-xs text-white/25">
                Source concentration and detection-class behavior.
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartShell
              code="ANALYTICS-03"
              title="Top Sources"
              description="Highest-volume telemetry sources returned by the backend."
            >
              <TopSourcesChart
                params={{
                  limit: 8,
                }}
              />
            </ChartShell>

            <DetectionTypesPanel
              detectionTypes={detectionTypes}
              loading={loading}
              totalDetections={totalDetections}
            />
          </div>
        </section>

        {/* Detection summary */}
        <section className="rounded-2xl border border-white/10 bg-[#070a08] shadow-[0_0_35px_rgba(0,0,0,0.25)]">
          <div className="border-b border-white/7 bg-black/20 px-5 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/60">
                  Detection Intelligence
                </div>

                <div className="mt-1 text-xs text-white/25">
                  Current detection-type counts returned by the backend.
                </div>
              </div>

              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/20">
                {totalDetections.toLocaleString()} SIGNALS
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8">
              <div className="h-10 animate-pulse rounded-lg bg-white/5" />
              <div className="mt-3 h-10 animate-pulse rounded-lg bg-white/5" />
              <div className="mt-3 h-10 animate-pulse rounded-lg bg-white/5" />
            </div>
          ) : detectionTypes.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                </div>

                <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                  No Detection Data
                </div>

                <p className="mt-2 text-xs text-white/20">
                  The backend returned no detection-type records.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-white/7 bg-black/10">
                  <tr className="text-[9px] uppercase tracking-[0.2em] text-white/25">
                    <th className="px-5 py-4 font-semibold">
                      Detection Type
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Count
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Share
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Distribution
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {detectionTypes.map((item) => {
                    const percentage =
                      percentageFor(
                        item.count,
                        totalDetections,
                      );

                    const tone =
                      typeTone(
                        item.detection_type,
                      );

                    return (
                      <tr
                        key={item.detection_type}
                        className="transition hover:bg-emerald-500/[0.025]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={
                                "h-2 w-2 rounded-full " +
                                tone.dot
                              }
                            />

                            <span className="text-xs font-semibold uppercase tracking-wide text-white/65">
                              {item.detection_type}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-mono text-sm font-bold text-white/75">
                            {item.count.toLocaleString()}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={
                              "font-mono text-xs font-bold " +
                              tone.text
                            }
                          >
                            {percentage.toFixed(1)}%
                          </span>
                        </td>

                        <td className="min-w-[220px] px-5 py-4">
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                            <div
                              className={
                                "h-full rounded-full transition-all " +
                                (tone.dot ===
                                "bg-purple-400"
                                  ? "bg-purple-400"
                                  : tone.dot ===
                                      "bg-orange-400"
                                    ? "bg-orange-400"
                                    : tone.dot ===
                                        "bg-emerald-400"
                                      ? "bg-emerald-400"
                                      : "bg-white/40")
                              }
                              style={{
                                width:
                                  percentageWidth(
                                    item.count,
                                    totalDetections,
                                  ) + "%",
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Analyst footer */}
        <section className="grid gap-4 md:grid-cols-3">
          <AnalystPanel
            label="Temporal Analysis"
            value="24 HOURS"
            detail="Event trend window"
          />

          <AnalystPanel
            label="Source Analysis"
            value="TOP 8"
            detail="Highest-volume telemetry sources"
          />

          <AnalystPanel
            label="Detection Analysis"
            value={`${detectionTypeCount} TYPES`}
            detail="Current stored detection classes"
          />
        </section>
      </div>
    </PageContainer>
  );
}

function AnalyticsMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/30">
        {label}
      </div>

      <div className="mt-1 font-mono text-lg font-black text-emerald-300">
        {value}
      </div>

      <div className="mt-1 max-w-[130px] truncate text-[8px] uppercase tracking-[0.12em] text-white/20">
        {detail}
      </div>
    </div>
  );
}

function ChartShell({
  code,
  title,
  description,
  children,
}: {
  code: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#070a08] shadow-[0_0_30px_rgba(0,0,0,0.25)]">
      <div className="border-b border-white/7 bg-black/20 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">
              {title}
            </div>

            <div className="mt-1 text-xs text-white/25">
              {description}
            </div>
          </div>

          <div className="shrink-0 font-mono text-[8px] uppercase tracking-[0.16em] text-emerald-400/40">
            {code}
          </div>
        </div>
      </div>

      <div className="min-h-[300px] bg-[#060907] p-4">
        {children}
      </div>
    </section>
  );
}

function DetectionTypesPanel({
  detectionTypes,
  loading,
  totalDetections,
}: {
  detectionTypes: DetectionTypeDistributionItem[];
  loading: boolean;
  totalDetections: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#070a08] shadow-[0_0_30px_rgba(0,0,0,0.25)]">
      <div className="border-b border-white/7 bg-black/20 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">
              Detection Types
            </div>

            <div className="mt-1 text-xs text-white/25">
              Distribution of stored detections.
            </div>
          </div>

          {!loading && (
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-400/45">
              {totalDetections.toLocaleString()} TOTAL
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="space-y-4">
            <div className="h-14 animate-pulse rounded-xl bg-white/5" />
            <div className="h-14 animate-pulse rounded-xl bg-white/5" />
            <div className="h-14 animate-pulse rounded-xl bg-white/5" />
          </div>
        ) : detectionTypes.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-center">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                No detection data
              </div>

              <div className="mt-2 text-xs text-white/20">
                Nothing available for distribution analysis.
              </div>
            </div>
          </div>
        ) : (
          <div className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
            {detectionTypes.map((item) => {
              const percentage =
                percentageFor(
                  item.count,
                  totalDetections,
                );

              const tone =
                typeTone(
                  item.detection_type,
                );

              return (
                <div
                  key={item.detection_type}
                  className={
                    "rounded-xl border p-4 " +
                    tone.border +
                    " " +
                    tone.bg
                  }
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={
                          "h-1.5 w-1.5 shrink-0 rounded-full " +
                          tone.dot
                        }
                      />

                      <span className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-white/60">
                        {item.detection_type}
                      </span>
                    </div>

                    <div className="shrink-0 font-mono text-[10px] text-white/35">
                      {item.count.toLocaleString()}{" "}
                      / {percentage.toFixed(1)}%
                    </div>
                  </div>

                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/30">
                    <div
                      className={
                        "h-full rounded-full " +
                        (tone.dot ===
                        "bg-purple-400"
                          ? "bg-purple-400"
                          : tone.dot ===
                              "bg-orange-400"
                            ? "bg-orange-400"
                            : tone.dot ===
                                "bg-emerald-400"
                              ? "bg-emerald-400"
                              : "bg-white/40")
                      }
                      style={{
                        width:
                          percentageWidth(
                            item.count,
                            totalDetections,
                          ) + "%",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function AnalystPanel({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#070a08] p-5">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />

        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
          {label}
        </span>
      </div>

      <div className="mt-4 font-mono text-lg font-black text-emerald-300">
        {value}
      </div>

      <div className="mt-1 text-[9px] uppercase tracking-[0.13em] text-white/20">
        {detail}
      </div>
    </div>
  );
}