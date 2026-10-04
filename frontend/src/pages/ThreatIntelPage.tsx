import { useEffect, useState } from "react";
import PageContainer from "../components/layout/PageContainer";
import apiClient from "../services/apiClient";

interface IndicatorRow {
  id?: number;
  type?: string;
  value?: string;
  risk_level?: string;
  description?: string | null;
  source?: string;
  added_at?: string;
}

function normalizeRows(value: unknown): IndicatorRow[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is IndicatorRow =>
        typeof item === "object" &&
        item !== null,
    );
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const object = value as Record<string, unknown>;

    for (const key of [
      "items",
      "indicators",
      "data",
    ]) {
      const candidate = object[key];

      if (Array.isArray(candidate)) {
        return candidate.filter(
          (item): item is IndicatorRow =>
            typeof item === "object" &&
            item !== null,
        );
      }
    }
  }

  return [];
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function riskClass(
  risk?: string,
): string {
  switch (String(risk ?? "").toLowerCase()) {
    case "critical":
      return "text-red-300";

    case "high":
      return "text-orange-300";

    case "medium":
      return "text-amber-300";

    case "low":
      return "text-sky-300";

    default:
      return "text-gray-400";
  }
}

export default function ThreatIntelPage() {
  const [rows, setRows] =
    useState<IndicatorRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  async function load() {
    setLoading(true);

    try {
      const response =
        await apiClient.get<unknown>(
          "/indicators",
        );

      setRows(normalizeRows(response));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load threat intelligence indicators.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <PageContainer
      title="Threat Intelligence"
      subtitle="Local synthetic indicator records returned by the Sentinel-X API"
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {loading
            ? "Loading indicators..."
            : `${rows.length} indicator${
                rows.length === 1 ? "" : "s"
              } loaded`}
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-surface-600 px-3 py-2 text-xs text-gray-300 transition hover:bg-surface-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-700 bg-surface-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-surface-700 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">
                Type
              </th>

              <th className="px-4 py-3">
                Indicator
              </th>

              <th className="px-4 py-3">
                Risk Level
              </th>

              <th className="px-4 py-3">
                Description
              </th>

              <th className="px-4 py-3">
                Source
              </th>

              <th className="px-4 py-3">
                Added
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-surface-700/60">
            {rows.map((row, index) => (
              <tr
                key={
                  row.id ??
                  `${row.type}-${row.value}-${index}`
                }
                className="transition hover:bg-surface-700/30"
              >
                <td className="px-4 py-3 font-semibold text-gray-300">
                  {row.type ?? "—"}
                </td>

                <td className="px-4 py-3 font-mono text-xs text-gray-200">
                  {row.value ?? "—"}
                </td>

                <td
                  className={`px-4 py-3 font-semibold uppercase ${riskClass(
                    row.risk_level,
                  )}`}
                >
                  {row.risk_level ?? "—"}
                </td>

                <td className="max-w-md px-4 py-3 text-gray-400">
                  {row.description ?? "—"}
                </td>

                <td className="px-4 py-3 text-gray-400">
                  {row.source ?? "—"}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                  {formatDate(row.added_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            Loading indicators...
          </div>
        )}

        {!loading &&
          !error &&
          rows.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No indicators returned by the backend.
            </div>
          )}
      </div>
    </PageContainer>
  );
}