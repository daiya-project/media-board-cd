/**
 * Board (Dashboard) — trend list calculation.
 */

import type { DailyServiceRow, BoardTrendItem } from "@/types/app-db.types";
import { TREND_MIN_COST } from "@/lib/config";
import { calcChangeRate, calcMfr } from "./types";

/** Metric keys supported in trend calculations. */
export type TrendMetric = "adRevenue" | "vimp" | "mfr";

/** Maximum items per trend list. */
const TREND_COUNT = 10;

/**
 * Computes top-N service trend items for a given metric, comparing current
 * and previous date ranges.
 *
 * @param serviceData   - Service-level daily data from v_daily_by_service
 * @param currentDates  - Dates in the current period
 * @param previousDates - Dates in the comparison period
 * @param metric        - Which metric to rank by
 * @param direction     - "up" (top gainers) or "down" (top losers)
 * @returns Top-N BoardTrendItem[], sorted by changeRate
 */
export function calcTrendListByDateRange(
  serviceData: DailyServiceRow[],
  currentDates: string[],
  previousDates: string[],
  metric: TrendMetric,
  direction: "up" | "down",
): BoardTrendItem[] {
  const minCost = TREND_MIN_COST[metric];
  const currentSet = new Set(currentDates);
  const previousSet = new Set(previousDates);

  // Group current rows by service_id
  const currentByService = new Map<
    string,
    { costSpent: number; adRevenue: number; vimp: number; client_id: string; client_name: string; service_name: string }
  >();

  for (const r of serviceData) {
    if (!currentSet.has(r.date)) continue;
    const existing = currentByService.get(r.service_id);
    if (existing) {
      existing.costSpent += r.cost_spent;
      existing.adRevenue += r.ad_revenue;
      existing.vimp += r.vimp;
    } else {
      currentByService.set(r.service_id, {
        costSpent: r.cost_spent,
        adRevenue: r.ad_revenue,
        vimp: r.vimp,
        client_id: r.client_id,
        client_name: r.client_name,
        service_name: r.service_name,
      });
    }
  }

  // Group previous rows by service_id
  const prevByService = new Map<
    string,
    { costSpent: number; adRevenue: number; vimp: number }
  >();

  for (const r of serviceData) {
    if (!previousSet.has(r.date)) continue;
    const existing = prevByService.get(r.service_id);
    if (existing) {
      existing.costSpent += r.cost_spent;
      existing.adRevenue += r.ad_revenue;
      existing.vimp += r.vimp;
    } else {
      prevByService.set(r.service_id, {
        costSpent: r.cost_spent,
        adRevenue: r.ad_revenue,
        vimp: r.vimp,
      });
    }
  }

  // Build trend items
  const items: BoardTrendItem[] = [];

  for (const [service_id, current] of currentByService) {
    if (current.costSpent < minCost) continue;

    const prev = prevByService.get(service_id);

    let latestValue: number;
    let previousValue: number;
    let changeRate: number;

    if (metric === "adRevenue") {
      // UI 라벨 Ad Revenue = cost_spent (Report 섹션과 통일).
      latestValue = current.costSpent;
      previousValue = prev?.costSpent ?? 0;
      changeRate = calcChangeRate(latestValue, previousValue);
    } else if (metric === "vimp") {
      latestValue = current.vimp;
      previousValue = prev?.vimp ?? 0;
      changeRate = calcChangeRate(latestValue, previousValue);
    } else {
      latestValue = calcMfr(current.adRevenue, current.costSpent);
      previousValue = prev
        ? calcMfr(prev.adRevenue, prev.costSpent)
        : 0;
      changeRate = latestValue - previousValue;
    }

    if (direction === "up" && changeRate <= 0) continue;
    if (direction === "down" && changeRate >= 0) continue;

    items.push({
      service_id,
      service_name: current.service_name,
      client_id: current.client_id,
      client_name: current.client_name,
      latestValue,
      previousValue,
      changeRate,
    });
  }

  items.sort((a, b) =>
    direction === "up"
      ? b.changeRate - a.changeRate
      : a.changeRate - b.changeRate,
  );

  return items.slice(0, TREND_COUNT);
}
