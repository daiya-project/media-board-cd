/**
 * MA Chart — entity grouping, ranking, and display dates.
 */

import type { DailyServiceRow, DailyRawRow } from "@/types/app-db.types";
import type { MaEntitySeries, MaEntityDailyData, MaDateRange } from "./types";

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Groups raw rows by service or widget into per-entity time series.
 *
 * @param rows - Raw daily rows (service-level or widget-level)
 * @param mode - "service" groups by service_id, "widget" by service_id:widget_id
 * @returns Map keyed by entity ID
 */
export function groupByEntity(
  rows: DailyServiceRow[] | DailyRawRow[],
  mode: "service" | "widget",
): Map<string, MaEntitySeries> {
  const map = new Map<string, MaEntitySeries>();

  for (const row of rows) {
    const isWidget = mode === "widget" && "widget_id" in row && row.widget_id;
    const entityId = isWidget
      ? `${row.service_id}:${(row as DailyRawRow).widget_id}`
      : row.service_id;
    const entityName = isWidget
      ? `${row.service_name} - ${(row as DailyRawRow).widget_name ?? `Widget ${(row as DailyRawRow).widget_id}`}`
      : row.service_name;

    let series = map.get(entityId);
    if (!series) {
      series = {
        entityId,
        entityName,
        clientId: row.client_id,
        clientName: row.client_name,
        serviceId: row.service_id,
        serviceName: row.service_name,
        dailyData: new Map(),
      };
      map.set(entityId, series);
    }

    const existing = series.dailyData.get(row.date);
    if (existing) {
      // Accumulate for same entity+date (shouldn't happen for service-level but safe)
      existing.cost_spent += row.cost_spent;
      existing.ad_revenue += row.ad_revenue;
      existing.imp += row.imp;
      existing.vimp += row.vimp;
      existing.cnt_click += row.cnt_click;
    } else {
      series.dailyData.set(row.date, {
        cost_spent: row.cost_spent,
        ad_revenue: row.ad_revenue,
        imp: row.imp,
        vimp: row.vimp,
        cnt_click: row.cnt_click,
      });
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Ranks entities by total ad_revenue within the given display dates.
 * Always sorts by ad_revenue regardless of the selected metric.
 *
 * @returns Entity IDs sorted by descending ad_revenue sum
 */
export function rankEntitiesByRevenue(
  grouped: Map<string, MaEntitySeries>,
  displayDates: string[],
): string[] {
  const displaySet = new Set(displayDates);
  const sums: Array<{ id: string; sum: number }> = [];

  for (const [id, series] of grouped) {
    let sum = 0;
    for (const [date, data] of series.dailyData) {
      if (displaySet.has(date)) sum += data.ad_revenue;
    }
    sums.push({ id, sum });
  }

  sums.sort((a, b) => b.sum - a.sum);
  return sums.map((s) => s.id);
}

// ---------------------------------------------------------------------------
// Display dates computation
// ---------------------------------------------------------------------------

/**
 * Computes the display date subset from allDates based on the range setting.
 *
 * @param allDates - All fetched dates, newest first
 * @param dateRange - Selected date range preset
 * @param customRange - Custom from/to dates (used when dateRange === "custom")
 * @returns Display dates in oldest-first order
 */
export function computeDisplayDates(
  allDates: string[],
  dateRange: MaDateRange,
  customRange: { from: string; to: string } | null,
): string[] {
  const sorted = [...allDates].sort(); // oldest first

  if (dateRange === "custom" && customRange) {
    return sorted.filter(
      (d) => d >= customRange.from && d <= customRange.to,
    );
  }

  const dayMap: Record<string, number> = { "15d": 15, "30d": 30, "90d": 90 };
  const count = dayMap[dateRange] ?? 30;

  // Take the most recent `count` dates (newest-first from allDates, then reverse)
  const newest = allDates.slice(0, count);
  return [...newest].sort();
}
