/**
 * Sentinel-X — FilterBar Component
 *
 * Reusable filter bar for list pages (Events, Alerts, Incidents).
 *
 * Supports:
 *   - Text search input
 *   - Severity filter (matches backend: low/medium/high/critical)
 *   - Time range selector
 *   - Arbitrary additional filter selects
 *   - Apply / Reset callbacks
 */

import React, { useCallback } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import type { Severity } from "../../types/event";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterField {
  id: string;
  label: string;
  options: FilterOption[];
  placeholder?: string;
}

export interface FilterValues {
  search?: string;
  severity?: Severity | "";
  timeRange?: string;
  [key: string]: string | undefined;
}

export interface FilterBarProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onApply?: () => void;
  onReset?: () => void;
  additionalFilters?: FilterField[];
  showSeverityFilter?: boolean;
  showTimeRange?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_OPTIONS: FilterOption[] = [
  { value: "",         label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high",     label: "High" },
  { value: "medium",   label: "Medium" },
  { value: "low",      label: "Low" },
];

const TIME_RANGE_OPTIONS: FilterOption[] = [
  { value: "1h",  label: "Last 1 Hour" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d",  label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SelectProps {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

function FilterSelect({ id, label, value, options, onChange }: SelectProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-gray-400 font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          bg-surface-700 border border-surface-500 text-gray-200
          text-sm rounded-lg px-3 py-2 min-w-[140px]
          focus:outline-none focus:ring-1 focus:ring-sentinel-500
          focus:border-sentinel-500 cursor-pointer
        "
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterBar component
// ---------------------------------------------------------------------------

export function FilterBar({
  values,
  onChange,
  onApply,
  onReset,
  additionalFilters = [],
  showSeverityFilter = true,
  showTimeRange = true,
  showSearch = true,
  searchPlaceholder = "Search events…",
  className = "",
}: FilterBarProps): React.JSX.Element {

  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      onChange({ ...values, [field]: value });
    },
    [values, onChange]
  );

  const hasActiveFilters =
    (values.search && values.search.length > 0) ||
    (values.severity && values.severity.length > 0) ||
    (values.timeRange && values.timeRange.length > 0) ||
    additionalFilters.some((f) => values[f.id] && values[f.id]!.length > 0);

  return (
    <div
      className={`
        flex flex-wrap items-end gap-3 p-4
        bg-surface-800 border border-surface-600 rounded-xl
        ${className}
      `}
    >
      <SlidersHorizontal size={16} className="text-gray-400 self-center mb-2 flex-shrink-0" aria-hidden="true" />

      {/* Search */}
      {showSearch && (
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label htmlFor="filter-search" className="text-xs text-gray-400 font-medium">
            Search
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              aria-hidden="true"
            />
            <input
              id="filter-search"
              type="text"
              value={values.search ?? ""}
              onChange={(e) => handleFieldChange("search", e.target.value)}
              placeholder={searchPlaceholder}
              className="
                w-full bg-surface-700 border border-surface-500
                text-gray-200 text-sm rounded-lg pl-8 pr-3 py-2
                placeholder-gray-500
                focus:outline-none focus:ring-1 focus:ring-sentinel-500
                focus:border-sentinel-500
              "
            />
          </div>
        </div>
      )}

      {/* Severity filter */}
      {showSeverityFilter && (
        <FilterSelect
          id="filter-severity"
          label="Severity"
          value={values.severity ?? ""}
          options={SEVERITY_OPTIONS}
          onChange={(v) => handleFieldChange("severity", v)}
        />
      )}

      {/* Time range */}
      {showTimeRange && (
        <FilterSelect
          id="filter-timerange"
          label="Time Range"
          value={values.timeRange ?? "24h"}
          options={TIME_RANGE_OPTIONS}
          onChange={(v) => handleFieldChange("timeRange", v)}
        />
      )}

      {/* Additional dynamic filters */}
      {additionalFilters.map((field) => (
        <FilterSelect
          key={field.id}
          id={`filter-${field.id}`}
          label={field.label}
          value={values[field.id] ?? ""}
          options={[
            { value: "", label: field.placeholder ?? `All ${field.label}` },
            ...field.options,
          ]}
          onChange={(v) => handleFieldChange(field.id, v)}
        />
      ))}

      {/* Action buttons */}
      <div className="flex items-center gap-2 self-end mb-0">
        {onApply && (
          <button
            onClick={onApply}
            className="
              px-4 py-2 bg-sentinel-600 hover:bg-sentinel-500
              text-white text-sm font-medium rounded-lg
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-sentinel-500 focus:ring-offset-2 focus:ring-offset-surface-900
            "
          >
            Apply
          </button>
        )}
        {onReset && hasActiveFilters && (
          <button
            onClick={onReset}
            className="
              px-3 py-2 text-gray-400 hover:text-gray-200
              text-sm font-medium rounded-lg
              hover:bg-surface-700
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-surface-500 focus:ring-offset-2 focus:ring-offset-surface-900
              inline-flex items-center gap-1.5
            "
          >
            <X size={14} aria-hidden="true" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

export default FilterBar;