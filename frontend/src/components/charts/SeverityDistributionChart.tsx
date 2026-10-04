import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { PieChart as PieIcon } from "lucide-react";

import {
  getSeverityDistribution,
} from "../../services/analyticsService";

import type {
  SeverityDistributionItem,
} from "../../types/analytics";

import type { Severity } from "../../types/event";

// ---------------------------------------------------------------------------
// Severity colors
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<Severity, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: {
      percentage: number;
    };
  }>;
}

function CustomTooltip({
  active,
  payload,
}: TooltipProps): React.JSX.Element | null {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];

  return (
    <div className="rounded-lg border border-surface-500 bg-surface-700 px-3 py-2 shadow-xl">
      <p className="mb-0.5 text-xs capitalize text-gray-400">
        {item.name}
      </p>

      <p className="text-sm font-semibold text-white">
        {item.value.toLocaleString()} events
      </p>

      <p className="text-xs text-gray-500">
        {item.payload.percentage.toFixed(1)}%
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function SeverityLegend({
  distribution,
}: {
  distribution: SeverityDistributionItem[];
}): React.JSX.Element {
  const total = distribution.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  return (
    <div className="flex flex-col justify-center gap-2">
      {distribution.map((item) => {
        const severity = item.severity as Severity;
        const color =
          SEVERITY_COLORS[severity] ?? "#6b7280";

        const percentage =
          total > 0
            ? (item.count / total) * 100
            : 0;

        return (
          <div
            key={item.severity}
            className="flex items-center gap-2"
          >
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{
                backgroundColor: color,
              }}
              aria-hidden="true"
            />

            <span className="w-16 text-xs capitalize text-gray-400">
              {item.severity}
            </span>

            <span className="ml-auto text-xs font-medium tabular-nums text-gray-200">
              {item.count.toLocaleString()}
            </span>

            <span className="w-10 text-right text-xs tabular-nums text-gray-500">
              {percentage.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SeverityDistributionChartProps {
  height?: number;
  className?: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SeverityDistributionChart({
  height = 200,
  className = "",
  title = "Severity Distribution",
}: SeverityDistributionChartProps): React.JSX.Element {
  const [data, setData] = useState<
    SeverityDistributionItem[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    null,
  );

  const fetchData = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const result =
          await getSeverityDistribution(signal);

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
            : "Failed to load severity distribution.",
        );
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller =
      new AbortController();

    void fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchData]);

  const total = data.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  const chartData = data.map((item) => ({
    name: item.severity,
    value: item.count,
    percentage:
      total > 0
        ? (item.count / total) * 100
        : 0,
    fill:
      SEVERITY_COLORS[item.severity as Severity] ??
      "#6b7280",
  }));

  return (
    <div
      className={`rounded-xl border border-surface-600 bg-surface-800 p-5 ${className}`}
    >
      <div className="mb-4 flex items-center gap-2">
        <PieIcon
          size={16}
          className="text-sentinel-400"
          aria-hidden="true"
        />

        <h3 className="text-sm font-semibold text-gray-200">
          {title}
        </h3>

        {!loading && !error && (
          <span className="ml-auto text-xs text-gray-500">
            {total.toLocaleString()} total
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
            No data available.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <ResponsiveContainer
            width="50%"
            height={height}
          >
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={height * 0.28}
                outerRadius={height * 0.44}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.fill}
                  />
                ))}
              </Pie>

              <Tooltip
                content={<CustomTooltip />}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="min-w-0 flex-1">
            <SeverityLegend
              distribution={data}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default SeverityDistributionChart;