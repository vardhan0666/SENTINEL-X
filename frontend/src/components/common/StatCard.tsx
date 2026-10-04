/**
 * Sentinel-X — StatCard Component
 *
 * Displays a single dashboard metric with an optional icon,
 * trend indicator, and colour variant.
 *
 * Used on the Overview page and Analytics page.
 */

import React from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StatCardVariant =
  | "default"
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info"
  | "success";

export type TrendDirection = "up" | "down" | "neutral";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: StatCardVariant;
  trend?: {
    direction: TrendDirection;
    value: string;
    label?: string;
  };
  loading?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const VARIANT_STYLES: Record<StatCardVariant, {
  card: string;
  icon: string;
  value: string;
}> = {
  default:  {
    card:  "bg-surface-800 border-surface-600",
    icon:  "bg-sentinel-900/50 text-sentinel-400",
    value: "text-white",
  },
  critical: {
    card:  "bg-surface-800 border-red-700/50",
    icon:  "bg-red-900/30 text-red-400",
    value: "text-red-400",
  },
  high:     {
    card:  "bg-surface-800 border-orange-700/50",
    icon:  "bg-orange-900/30 text-orange-400",
    value: "text-orange-400",
  },
  medium:   {
    card:  "bg-surface-800 border-amber-700/50",
    icon:  "bg-amber-900/30 text-amber-400",
    value: "text-amber-400",
  },
  low:      {
    card:  "bg-surface-800 border-green-700/50",
    icon:  "bg-green-900/30 text-green-400",
    value: "text-green-400",
  },
  info:     {
    card:  "bg-surface-800 border-blue-700/50",
    icon:  "bg-blue-900/30 text-blue-400",
    value: "text-blue-400",
  },
  success:  {
    card:  "bg-surface-800 border-emerald-700/50",
    icon:  "bg-emerald-900/30 text-emerald-400",
    value: "text-emerald-400",
  },
};

const TREND_STYLES: Record<TrendDirection, { color: string; Icon: LucideIcon }> = {
  up:      { color: "text-red-400",   Icon: TrendingUp },
  down:    { color: "text-green-400", Icon: TrendingDown },
  neutral: { color: "text-gray-400",  Icon: Minus },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  trend,
  loading = false,
  className = "",
}: StatCardProps): React.JSX.Element {
  const styles = VARIANT_STYLES[variant];

  if (loading) {
    return (
      <div
        className={`
          rounded-xl border p-5 animate-pulse
          bg-surface-800 border-surface-600 ${className}
        `}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-24 bg-surface-600 rounded" />
          <div className="w-10 h-10 bg-surface-600 rounded-lg" />
        </div>
        <div className="h-8 w-20 bg-surface-600 rounded mb-2" />
        <div className="h-3 w-32 bg-surface-600 rounded" />
      </div>
    );
  }

  return (
    <div
      className={`
        rounded-xl border p-5 transition-colors duration-200
        hover:border-sentinel-700/50
        ${styles.card} ${className}
      `}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-400 leading-tight">{title}</p>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.icon}`}>
            <Icon size={18} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Value */}
      <p className={`text-3xl font-bold tabular-nums leading-none mb-1 ${styles.value}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>

      {/* Subtitle / trend */}
      <div className="flex items-center gap-2 mt-2">
        {trend && (() => {
          const { color, Icon: TrendIcon } = TREND_STYLES[trend.direction];
          return (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
              <TrendIcon size={12} aria-hidden="true" />
              {trend.value}
            </span>
          );
        })()}
        {(subtitle || trend?.label) && (
          <p className="text-xs text-gray-500 truncate">
            {trend?.label ?? subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export default StatCard;