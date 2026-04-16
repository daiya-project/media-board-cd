/**
 * Data-Board statistical calculations.
 *
 * Computes the Average, Previous Day, and Change comparison values shown in
 * the fixed stat columns. isWeekday is imported from lib/utils/date-utils.ts
 * (shared pure utility).
 *
 * Naming convention:
 *   D-0 = dates[0] (latest / "today" per DB)
 *   D-1 = dates[1] (the day before D-0)
 *   D-1 … D-13 = the 13-day baseline window for the average calculation
 */

import type { DataMetricType, RawDateComponents } from "@/types/app-db.types";
import { isWeekday } from "@/lib/utils/date-utils";
import { isPercentType } from "@/lib/utils/number-utils";

// ---------------------------------------------------------------------------
// calculateAverage
// ---------------------------------------------------------------------------

/**
 * Computes the comparison value for the "평균 (Average)" column.
 *
 * **Daily mode** (skipWeekdayFilter = false, default):
 *   Baseline: D-1 through D-13 (13 days), weekdays only (excludes weekends and holidays).
 *
 * **Period mode** (skipWeekdayFilter = true):
 *   Baseline: all past periods (D-1 through D-n), no weekday filtering.
 *   Used for weekly / monthly views where each column represents an aggregated period.
 *
 * - Percent types (mfr, vrate, vctr):
 *     Sums the raw numerator and denominator over all baseline periods, then
 *     computes the ratio. Returns: latestValue − weightedAvg (pp difference).
 * - Count types (adrevenue, pubprofit, imp, vimp):
 *     Simple arithmetic mean of baseline values.
 *     Returns: (latestValue / avg − 1) × 100  (% change).
 *
 * Returns null when the comparison cannot be calculated (no data,
 * zero denominator, etc.).
 *
 * @param dates               - Date/period strings, newest first
 * @param dateValues          - Per-date/period computed metric values for this row
 * @param holidays            - Set of holiday + weekend date strings (empty for period mode)
 * @param metricType          - Current metric type
 * @param rawDates            - Per-date/period raw components (needed for percent type avg)
 * @param skipWeekdayFilter   - If true, include all past periods without weekday filtering
 */
export function calculateAverage(
  dates: string[],
  dateValues: Map<string, number>,
  holidays: Set<string>,
  metricType: DataMetricType,
  rawDates: Map<string, RawDateComponents>,
  skipWeekdayFilter = false,
): number | null {
  const latestDate = dates[0];
  const latestValue = dateValues.get(latestDate) ?? 0;
  const pastDates = dates.slice(1); // D-1 to D-n

  if (isPercentType(metricType)) {
    let totalNum = 0;
    let totalDen = 0;

    for (const date of pastDates) {
      if (!skipWeekdayFilter && !isWeekday(date, holidays)) continue;
      const raw = rawDates.get(date);
      if (!raw) continue;

      switch (metricType) {
        case "mfr":
          totalNum += raw.ad_revenue;
          totalDen += raw.cost_spent;
          break;
        case "vrate":
          totalNum += raw.vimp;
          totalDen += raw.imp;
          break;
        case "vctr":
          totalNum += raw.cnt_click;
          totalDen += raw.vimp;
          break;
      }
    }

    if (totalDen <= 0) return null;
    const avg = (totalNum / totalDen) * 100;
    return latestValue - avg;
  }

  // Count type: average over qualifying past periods
  const values: number[] = [];
  for (const date of pastDates) {
    if (!skipWeekdayFilter && !isWeekday(date, holidays)) continue;
    values.push(dateValues.get(date) ?? 0);
  }

  if (values.length === 0) return null;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (avg === 0) return null;

  return ((latestValue / avg) - 1) * 100;
}

// ---------------------------------------------------------------------------
// calculatePreviousDay
// ---------------------------------------------------------------------------

/**
 * Computes the comparison value for the "전일 (Previous Day)" column.
 *
 * Compares D-0 (dates[0]) against D-1 (dates[1]).
 *
 * - Percent types: latestValue − previousValue (pp difference)
 * - Count types:   (latestValue / previousValue − 1) × 100 (% change)
 *
 * Returns null if there is no D-1 data or the previous value is zero (count types).
 *
 * @param dates      - 14 date strings, newest first
 * @param dateValues - Per-date computed metric values for this row
 * @param metricType - Current metric type
 */
export function calculatePreviousDay(
  dates: string[],
  dateValues: Map<string, number>,
  metricType: DataMetricType,
): number | null {
  if (dates.length < 2) return null;

  const latest = dateValues.get(dates[0]) ?? 0;
  const previous = dateValues.get(dates[1]) ?? 0;

  if (isPercentType(metricType)) {
    return latest - previous;
  }

  if (previous === 0) return null;
  return ((latest / previous) - 1) * 100;
}

// ---------------------------------------------------------------------------
// calculateChange
// ---------------------------------------------------------------------------

/**
 * Computes the absolute difference for the "증감 (Change)" column.
 * Always D-0 minus D-1; shown only for count-type metrics.
 *
 * Returns null if there is no D-1 in the dates array.
 *
 * @param dates      - 14 date strings, newest first
 * @param dateValues - Per-date computed metric values for this row
 */
export function calculateChange(
  dates: string[],
  dateValues: Map<string, number>,
): number | null {
  if (dates.length < 2) return null;
  const latest = dateValues.get(dates[0]) ?? 0;
  const previous = dateValues.get(dates[1]) ?? 0;
  return latest - previous;
}

// ---------------------------------------------------------------------------
// sortDataRows
// ---------------------------------------------------------------------------

export type SortField =
  | "client"
  | "service"
  | "widget_id"
  | "widget_name"
  | "average"
  | "previous"
  | "change"
  | `date-${number}`;

export type { SortDirection, SortState } from "@/lib/utils/sort-utils";
import type { SortState } from "@/lib/utils/sort-utils";
import { compareNullable } from "@/lib/utils/sort-utils";

import type { DataBoardGroupedRow } from "@/types/app-db.types";

/**
 * Sorts grouped data rows for display.
 *
 * Default (sort.direction === 'none'): descending by D-0 value (latest date).
 * Otherwise: sorts by the selected field in the requested direction.
 *
 * Avg / Previous comparisons are computed inline during sort; this is acceptable
 * because sort only triggers on user interaction, not on every render.
 *
 * @param data       - Filtered grouped rows to sort
 * @param sort       - Current sort state (field + direction)
 * @param dates      - 14 date strings, newest first
 * @param metricType - Current metric type
 * @param holidays   - Set of holiday + weekend date strings
 */
export function sortDataRows(
  data: DataBoardGroupedRow[],
  sort: SortState<SortField>,
  dates: string[],
  metricType: DataMetricType,
  holidays: Set<string>,
): DataBoardGroupedRow[] {
  if (sort.direction === "none" || sort.field === null) {
    // Default: latest date value descending
    return [...data].sort((a, b) => {
      const av = a.dateValues.get(dates[0]) ?? 0;
      const bv = b.dateValues.get(dates[0]) ?? 0;
      return bv - av;
    });
  }

  const multiplier = sort.direction === "asc" ? 1 : -1;

  // Schwartzian transform: pre-compute sort keys once per row (O(n)),
  // then compare using the cached keys (O(n log n) lookups only).
  function getSortKey(row: DataBoardGroupedRow): string | number {
    switch (sort.field) {
      case "client":
        return `${row.client_id}. ${row.client_name}`.toLowerCase();
      case "service":
        return `${row.service_id}. ${row.service_name}`.toLowerCase();
      case "widget_id":
        return row.widget_id ?? "";
      case "widget_name":
        return (row.widget_name ?? "").toLowerCase();
      case "average":
        return (
          calculateAverage(dates, row.dateValues, holidays, metricType, row.rawDates) ??
          -Infinity
        );
      case "previous":
        return calculatePreviousDay(dates, row.dateValues, metricType) ?? -Infinity;
      case "change":
        return calculateChange(dates, row.dateValues) ?? -Infinity;
      default: {
        const field = sort.field as string;
        if (field.startsWith("date-")) {
          const idx = parseInt(field.slice(5), 10);
          return row.dateValues.get(dates[idx]) ?? 0;
        }
        return "";
      }
    }
  }

  const decorated = data.map((row) => ({ row, key: getSortKey(row) }));

  decorated.sort((a, b) =>
    compareNullable(a.key, b.key, multiplier, { locale: "ko", numeric: true }),
  );

  return decorated.map((d) => d.row);
}
