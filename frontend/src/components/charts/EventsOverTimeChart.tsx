/**
 * Sentinel-X — Events Over Time Chart
 *
 * Uses the real backend endpoint:
 *   GET /api/v1/analytics/events-over-time
 *
 * Backend response:
 *   [{ bucket: ISO timestamp, count: number }]
 */

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TrendingUp } from "lucide-react";

import {
  getEventsOverTime,
} from "../../services/analyticsService";

import type {
  EventsOverTimeParams,
  EventsOverTimePoint,
} from "../../types/analytics";

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
  }>;
  label?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: CustomTooltipProps): React.JSX.Element | null {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs text-gray-400">
        {label}
      </p>

      <p className="text-sm font-semibold text-sentinel-400">
        {payload[0].value.toLocaleString()} events
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLabel(
  timestamp: string,
  hours: number,
): string {
  const date = new Date(timestamp);

  if (hours <= 24) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EventsOverTimeChartProps {
  params?: EventsOverTimeParams;
  height?: number;
  className?: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventsOverTimeChart({
  params = {
    hours: 24,
    bucket_minutes: 60,
  },
  height = 220,
  className = "",
  title = "Events Over Time",
}: EventsOverTimeChartProps): React.JSX.Element {
  const [data, setData] = useState<EventsOverTimePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const result = await getEventsOverTime(
          params,
          signal,
        );

        setData(result);
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
            : "Failed to load event volume data.",
        );
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [params],
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchData]);

  const hours = params.hours ?? 24;

  const chartData = data.map((point) => ({
    time: formatLabel(point.bucket, hours),
    value: point.count,
  }));

  const total = data.reduce(
    (sum, point) => sum + point.count,
    0,
  );

  return (
    <div
      className={`rounded-xl border border-surface-600 bg-surface-800 p-5 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp
            size={16}
            className="text-sentinel-400"
            aria-hidden="true"
          />

          <h3 className="text-sm font-semibold text-gray-200">
            {title}
          </h3>
        </div>

        {!loading && !error && (
          <span className="text-xs text-gray-500">
            Total: {total.toLocaleString()}
          </span>
        )}
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center rounded-lg bg-surface-700/30 animate-pulse"
          style={{ height }}
        >
          <p className="text-xs text-gray-600">
            Loading chart…
          </p>
        </div>
      ) : error ? (
        <div
          className="flex items-center justify-center rounded-lg bg-surface-700/20"
          style={{ height }}
        >
          <p className="text-xs text-red-400">
            {error}
          </p>
        </div>
      ) : chartData.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-lg bg-surface-700/20"
          style={{ height }}
        >
          <p className="text-xs text-gray-500">
            No event data available.
          </p>
        </div>
      ) : (
        <ResponsiveContainer
          width="100%"
          height={height}
        >
          <AreaChart
            data={chartData}
            margin={{
              top: 4,
              right: 4,
              left: -20,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient
                id="eventGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="#6366f1"
                  stopOpacity={0.3}
                />

                <stop
                  offset="95%"
                  stopColor="#6366f1"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1a2540"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              tick={{
                fill: "#6b7280",
                fontSize: 11,
              }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              tick={{
                fill: "#6b7280",
                fontSize: 11,
              }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />

            <Tooltip
              content={<CustomTooltip />}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#eventGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: "#6366f1",
                strokeWidth: 0,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default EventsOverTimeChart;