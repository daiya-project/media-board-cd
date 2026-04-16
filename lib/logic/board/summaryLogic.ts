/**
 * Board (Dashboard) — KPI summary calculation.
 */

import type {
  DailyTotalRow,
  DailyServiceRow,
  BoardSummary,
  BoardSummaryMetric,
} from "@/types/app-db.types";
import { calcChangeRate, calcMfr, aggregateTotalRows } from "./types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeSummaryMetric(
  latestVal: number,
  prevVal: number,
  isMfr = false,
): BoardSummaryMetric {
  const changeRate = isMfr
    ? latestVal - prevVal
    : calcChangeRate(latestVal, prevVal);
  return { latestValue: latestVal, previousValue: prevVal, changeRate };
}

// ---------------------------------------------------------------------------
// aggregateServiceToTotal
// ---------------------------------------------------------------------------

/**
 * Aggregates DailyServiceRow[] into DailyTotalRow[] by summing all services
 * per date. Used when client filters are active.
 *
 * @param serviceData - Service-level rows (already filtered by client_ids)
 * @returns Array of DailyTotalRow (one per date)
 */
export function aggregateServiceToTotal(
  serviceData: DailyServiceRow[],
): DailyTotalRow[] {
  const map = new Map<string, DailyTotalRow>();

  for (const r of serviceData) {
    const existing = map.get(r.date);
    if (existing) {
      existing.cost_spent += r.cost_spent;
      existing.ad_revenue += r.ad_revenue;
      existing.imp += r.imp;
      existing.vimp += r.vimp;
      existing.cnt_click += r.cnt_click;
    } else {
      map.set(r.date, {
        date: r.date,
        cost_spent: r.cost_spent,
        ad_revenue: r.ad_revenue,
        imp: r.imp,
        vimp: r.vimp,
        cnt_click: r.cnt_click,
      });
    }
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// calcBoardSummaryByDateRange
// ---------------------------------------------------------------------------

/**
 * Computes KPI card values (Ad Revenue, vIMP, MFR) for a current date range
 * vs a previous date range, then calculates change rates.
 *
 * @param totalData     - Daily total rows
 * @param currentDates  - Dates in the current period
 * @param previousDates - Dates in the comparison period
 * @returns BoardSummary with latestValue, previousValue, changeRate for each KPI
 */
export function calcBoardSummaryByDateRange(
  totalData: DailyTotalRow[],
  currentDates: string[],
  previousDates: string[],
): BoardSummary {
  const current = aggregateTotalRows(totalData, currentDates);
  const prev = aggregateTotalRows(totalData, previousDates);

  const currentMfr = calcMfr(current.adRevenue, current.costSpent);
  const prevMfr = calcMfr(prev.adRevenue, prev.costSpent);

  return {
    adRevenue: makeSummaryMetric(current.adRevenue, prev.adRevenue),
    vimp: makeSummaryMetric(current.vimp, prev.vimp),
    mfr: makeSummaryMetric(currentMfr, prevMfr, true),
  };
}
