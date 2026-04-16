/**
 * Number and metric formatting utilities.
 * Shared across DATA, Dashboard, and other sections that display ad metrics.
 */

import type { DataMetricType } from "@/types/app-db.types";

/** Metric types that express a ratio/percentage (not a raw count). */
const PERCENT_TYPES = new Set<DataMetricType>(["mfr", "vrate", "vctr"]);

/**
 * Returns true if the given metric type is a ratio/percentage type.
 * Used to determine formatting rules and whether to show the Change column.
 *
 * @param metricType - The metric type to check
 */
export function isPercentType(metricType: DataMetricType): boolean {
  return PERCENT_TYPES.has(metricType);
}

/**
 * Returns true if the Change (증감) column should be shown for this metric type.
 * The Change column is hidden for percentage types (mfr, vrate, vctr).
 *
 * @param metricType - The current metric type
 */
export function showChangeColumn(metricType: DataMetricType): boolean {
  return !PERCENT_TYPES.has(metricType);
}

/**
 * Formats a raw metric value for display in a date cell.
 *
 * - adrevenue, pubprofit, imp, vimp → thousands separator (1,234,567)
 * - mfr → X.X%
 * - vrate → X.XX%
 * - vctr → X.XXX%
 * - null / NaN / undefined → '-'
 *
 * @param value - The numeric value to format
 * @param metricType - The metric type that determines the format
 */
export function formatMetricValue(
  value: number | null | undefined,
  metricType: DataMetricType,
): string {
  if (value === null || value === undefined || isNaN(value)) return "-";

  switch (metricType) {
    case "adrevenue":
    case "pubprofit":
    case "imp":
    case "vimp":
      return Math.round(value).toLocaleString("ko-KR");
    case "mfr":
      return `${value.toFixed(1)}%`;
    case "vrate":
      return `${value.toFixed(2)}%`;
    case "vctr":
      return `${value.toFixed(3)}%`;
    default:
      return Math.round(value).toLocaleString("ko-KR");
  }
}

/**
 * Formats a comparison value for the Average or Previous Day column.
 *
 * - Percentage types (mfr, vrate, vctr): shows pp difference as "+X.X%"
 * - Count types: shows percent change as "+X.X%"
 * - null → '-'
 *
 * @param value - The computed comparison value
 * @param metricType - The current metric type
 */
export function formatComparison(
  value: number | null,
  metricType: DataMetricType,
): string {
  if (value === null || isNaN(value)) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Formats the absolute change value (D-0 minus D-1) for the Change column.
 *
 * - mfr → X.X%p (percentage point)
 * - vrate → X.XX%p
 * - vctr → X.XXX%p
 * - count types → thousands separator
 * - null → '-'
 *
 * @param value - The absolute difference value
 * @param metricType - The current metric type
 */
export function formatChange(
  value: number | null,
  metricType: DataMetricType,
): string {
  if (value === null || isNaN(value)) return "-";
  switch (metricType) {
    case "mfr":
      return `${value.toFixed(1)}%p`;
    case "vrate":
      return `${value.toFixed(2)}%p`;
    case "vctr":
      return `${value.toFixed(3)}%p`;
    default:
      return Math.round(value).toLocaleString("ko-KR");
  }
}

/**
 * General-purpose number formatter for chart tooltips and summary displays.
 *
 * - string → returned as-is (pre-formatted values such as "3.45%")
 * - number → comma-separated integer (ko-KR locale)
 * - non-finite / NaN → "-"
 *
 * @param value - A pre-formatted string or raw numeric value
 */
export function formatNumberForDisplay(value: string | number): string {
  if (typeof value === "string") return value;
  if (!isFinite(value) || isNaN(value)) return "-";
  return Math.round(value).toLocaleString("ko-KR");
}
