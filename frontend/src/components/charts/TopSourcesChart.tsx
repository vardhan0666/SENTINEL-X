/**
 * Sentinel-X — Top Sources Chart
 *
 * Uses the real backend endpoint:
 *   GET /api/v1/analytics/top-sources
 *
 * Backend response:
 *   [{ source_ip: string, count: number }]
 */

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Database } from "lucide-react";

import {
  getTopSources,
} from "../../services/analyticsService";

import type {
  TopSourceItem,
  TopSourcesParams,
} from "../../types/analytics";

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const BAR_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#f97316",
  "#ef4444",
];

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipProps {
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
}: TooltipProps): React.JSX.Element | null {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="max-w-[180px] rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 shadow-xl">
      <p className="mb-1 truncate text-xs text-gray-400">
        {label}
      </p>

      <p className="text-sm font-semibold text-white">
        {payload[0].value.toLocaleString()} events
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TopSourcesChartProps {
  params?: TopSourcesParams;
  height?: number;
  className?: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopSourcesChart({
  params = { limit: 8 },
  height = 220,
  className = "",
  title = "Top Event Sources",
}: TopSourcesChartProps): React.JSX.Element {
  const [data, setData] = useState<TopSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    null,
  );

  const fetchData = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const result = await getTopSources(
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
            : "Failed to load top sources data.",
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
    const controller =
      new AbortController();

    void fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchData]);

  const chartData = data.map((item, index) => ({
    source: item.source_ip,
    value: item.count,
    fill: BAR_COLORS[
      index % BAR_COLORS.length
    ],
  }));

  const total = data.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  return (
    <div
      className={`rounded-xl border border-surface-600 bg-surface-800 p-5 ${className}`}
    >
      <div className="mb-4 flex items-center gap-2">
        <Database
          size={16}
          className="text-sentinel-400"
          aria-hidden="true"
        />

        <h3 className="text-sm font-semibold text-gray-200">
          {title}
        </h3>

        {!loading && !error && (
          <span className="ml-auto text-xs text-gray-500">
            {total.toLocaleString()} events
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
            No source data available.
          </p>
        </div>
      ) : (
        <ResponsiveContainer
          width="100%"
          height={height}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{
              top: 0,
              right: 16,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1a2540"
              horizontal={false}
            />

            <XAxis
              type="number"
              tick={{
                fill: "#6b7280",
                fontSize: 11,
              }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />

            <YAxis
              type="category"
              dataKey="source"
              tick={{
                fill: "#9ca3af",
                fontSize: 11,
              }}
              axisLine={false}
              tickLine={false}
              width={120}
              tickFormatter={(value: string) =>
                value.length > 16
                  ? `${value.slice(0, 16)}…`
                  : value
              }
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                fill: "#1a2540",
              }}
            />

            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`${entry.source}-${index}`}
                  fill={entry.fill}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default TopSourcesChart;