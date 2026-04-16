/**
 * Board (Dashboard) section — shared types and internal helpers.
 *
 * Used across summaryLogic, chartLogic, and trendLogic.
 */

import type { DailyTotalRow, DailyServiceRow } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PeriodType = "daily" | "weekly" | "monthly";

export interface ChartGroup {
  label: string;
  dates: string[];
}

export interface PeriodDateRanges {
  /** Dates in the current period (newest-first within). */
  currentDates: string[];
  /** Dates in the comparison period (newest-first within). */
  previousDates: string[];
  /** Ordered chart groups for rendering (oldest → newest). */
  chartGroups: ChartGroup[];
}

// ---------------------------------------------------------------------------
// Shared internal helpers (used by 2+ modules)
// ---------------------------------------------------------------------------

/** Metric totals shape used internally. */
export interface MetricTotals {
  costSpent: number;
  adRevenue: number;
  vimp: number;
}

/** Percent-change rate between previous and current values. */
export function calcChangeRate(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr / prev) - 1) * 100;
}

/** MFR from summed raw components. */
export function calcMfr(adRevenue: number, costSpent: number): number {
  return costSpent > 0 ? (adRevenue / costSpent) * 100 : 0;
}

/** Aggregates DailyTotalRow[] for the given dates into metric totals. */
export function aggregateTotalRows(
  totalData: DailyTotalRow[],
  dates: string[],
): MetricTotals {
  const dateSet = new Set(dates);
  let costSpent = 0;
  let adRevenue = 0;
  let vimp = 0;
  for (const r of totalData) {
    if (!dateSet.has(r.date)) continue;
    costSpent += r.cost_spent;
    adRevenue += r.ad_revenue;
    vimp += r.vimp;
  }
  return { costSpent, adRevenue, vimp };
}
