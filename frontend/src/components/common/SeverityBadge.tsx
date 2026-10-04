/**
 * Sentinel-X — SeverityBadge Component
 *
 * Renders a colour-coded badge for the backend severity values:
 *   low | medium | high | critical
 *
 * Used throughout the dashboard wherever severity needs visual emphasis.
 */

import React from "react";
import type { Severity } from "../../types/event";

// ---------------------------------------------------------------------------
// Style maps — keys MUST match backend Severity type exactly
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<Severity, string> = {
  low:      "bg-green-900/40 text-green-400 border border-green-700/50",
  medium:   "bg-amber-900/40 text-amber-400 border border-amber-700/50",
  high:     "bg-orange-900/40 text-orange-400 border border-orange-700/50",
  critical: "bg-red-900/40 text-red-400 border border-red-600/60",
};

const SEVERITY_DOT: Record<Severity, string> = {
  low:      "bg-green-400",
  medium:   "bg-amber-400",
  high:     "bg-orange-400",
  critical: "bg-red-400",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  low:      "Low",
  medium:   "Medium",
  high:     "High",
  critical: "Critical",
};

// ---------------------------------------------------------------------------
// Size variants
// ---------------------------------------------------------------------------

type BadgeSize = "xs" | "sm" | "md";

const SIZE_STYLES: Record<BadgeSize, string> = {
  xs: "text-xs px-1.5 py-0.5 gap-1",
  sm: "text-xs px-2 py-0.5 gap-1.5",
  md: "text-sm px-2.5 py-1 gap-1.5",
};

const DOT_SIZES: Record<BadgeSize, string> = {
  xs: "w-1.5 h-1.5",
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SeverityBadgeProps {
  severity: Severity;
  size?: BadgeSize;
  showDot?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SeverityBadge({
  severity,
  size = "sm",
  showDot = true,
  className = "",
}: SeverityBadgeProps): React.JSX.Element {
  const baseStyles = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low;
  const sizeStyles = SIZE_STYLES[size];
  const dotColor = SEVERITY_DOT[severity] ?? SEVERITY_DOT.low;
  const dotSize = DOT_SIZES[size];
  const label = SEVERITY_LABEL[severity] ?? severity;

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${baseStyles} ${sizeStyles} ${className}
      `}
      aria-label={`Severity: ${label}`}
    >
      {showDot && (
        <span
          className={`rounded-full flex-shrink-0 ${dotColor} ${dotSize}`}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}

export default SeverityBadge;