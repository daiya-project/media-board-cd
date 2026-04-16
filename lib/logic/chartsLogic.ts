/**
 * chartsLogic.ts — analytical chart calculations.
 *
 * Pure functions for the Charts section (Moving Average + Normalized views).
 * Input: DailyTotalRow[] (oldest-first order expected by callers).
 */

import type { DailyTotalRow } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single point on a Moving Average chart. */
export interface MAChartPoint {
  /** MM/DD display label */
  label: string;
  /** Raw date string (YYYY-MM-DD) */
  date: string;
  adRevenue: number;
  vimp: number;
  mfr: number;
  /** Moving average for Ad Revenue — null while window is warming up */
  adRevenueMA: number | null;
  vimpMA: number | null;
  mfrMA: number | null;
}

/** A single point on the Normalized chart. */
export interface NormChartPoint {
  label: string;
  date: string;
  /** Normalized 0–100 values */
  adRevenue: number;
  vimp: number;
  mfr: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * N-point simple moving average.
 * Returns null for the first (window - 1) points that lack sufficient history.
 */
export function sma(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

/**
 * Min-max normalization to a 0–100 scale.
 * If all values are identical, all points return 50.
 */
function minMax(values: number[]): number[] {
  const finite = values.filter(isFinite);
  if (finite.length === 0) return values.map(() => 0);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min;
  if (range === 0) return values.map(() => 50);
  return values.map((v) => ((v - min) / range) * 100);
}

function dateLabelMD(date: string): string {
  return date.slice(5).replace("-", "/");
}

function calcMfr(adRevenue: number, costSpent: number): number {
  return costSpent > 0 ? (adRevenue / costSpent) * 100 : 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds Moving Average chart data from aggregate daily totals.
 *
 * @param totalData  - DailyTotalRow[] in newest-first order (from API)
 * @param dateRange  - How many most-recent days to include
 * @param maWindow   - Moving average window size (days)
 * @returns Chart points oldest → newest with actual + MA values
 */
export function calcMAChartPoints(
  totalData: DailyTotalRow[],
  dateRange: number,
  maWindow: number,
): MAChartPoint[] {
  // Reverse to oldest-first, slice to dateRange
  const slice = [...totalData].reverse().slice(-dateRange);

  const revenues = slice.map((r) => r.ad_revenue);
  const vimps = slice.map((r) => r.vimp);
  const mfrs = slice.map((r) => calcMfr(r.ad_revenue, r.cost_spent));

  const revMA = sma(revenues, maWindow);
  const vimpMA = sma(vimps, maWindow);
  const mfrMA = sma(mfrs, maWindow);

  return slice.map((row, i) => ({
    label: dateLabelMD(row.date),
    date: row.date,
    adRevenue: row.ad_revenue,
    vimp: row.vimp,
    mfr: calcMfr(row.ad_revenue, row.cost_spent),
    adRevenueMA: revMA[i],
    vimpMA: vimpMA[i],
    mfrMA: mfrMA[i],
  }));
}

/**
 * Builds Normalized chart data, mapping each metric to a 0–100 scale
 * so trend direction can be compared across metrics with different units.
 *
 * @param totalData  - DailyTotalRow[] in newest-first order (from API)
 * @param dateRange  - How many most-recent days to include
 * @returns Chart points oldest → newest with 0–100 normalized values
 */
export function calcNormChartPoints(
  totalData: DailyTotalRow[],
  dateRange: number,
): NormChartPoint[] {
  const slice = [...totalData].reverse().slice(-dateRange);

  const revenues = slice.map((r) => r.ad_revenue);
  const vimps = slice.map((r) => r.vimp);
  const mfrs = slice.map((r) => calcMfr(r.ad_revenue, r.cost_spent));

  const normRevenues = minMax(revenues);
  const normVimps = minMax(vimps);
  const normMfrs = minMax(mfrs);

  return slice.map((row, i) => ({
    label: dateLabelMD(row.date),
    date: row.date,
    adRevenue: normRevenues[i],
    vimp: normVimps[i],
    mfr: normMfrs[i],
  }));
}
