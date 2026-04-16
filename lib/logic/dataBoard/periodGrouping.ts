/**
 * Data-Board grouping — weekly and monthly period grouping.
 */

import type {
  WeeklyRawRow,
  MonthlyRawRow,
  DataFilterType,
  DataMetricType,
  DataBoardGroupedRow,
  RawDateComponents,
} from "@/types/app-db.types";
import { computeMetricValue, getGroupKey, emptyRawDateComponents } from "./shared";

// ---------------------------------------------------------------------------
// Weekly grouping
// ---------------------------------------------------------------------------

/**
 * Groups pre-aggregated weekly MV data by C/S/W granularity.
 *
 * Uses display_label as the period key (same as what DataTable expects).
 * Since v_weekly already has widget-level rows, grouping for C/S modes
 * sums across widgets within each (client or service) group.
 *
 * @param rawData    - Flat array of WeeklyRawRow from v_weekly
 * @param filterType - Grouping granularity: client / service / widget
 * @param metricType - Which metric to compute for dateValues
 * @returns Array of grouped rows with display_label-keyed Maps
 */
export function groupWeeklyRawData(
  rawData: WeeklyRawRow[],
  filterType: DataFilterType,
  metricType: DataMetricType,
): DataBoardGroupedRow[] {
  const map = new Map<string, DataBoardGroupedRow>();

  for (const row of rawData) {
    const key = getGroupKey(row, filterType);
    const periodKey = row.display_label;

    if (!map.has(key)) {
      map.set(key, {
        client_id: row.client_id,
        client_name: row.client_name,
        service_id: row.service_id,
        service_name: row.service_name,
        widget_id: filterType === "widget" ? row.widget_id : null,
        widget_name: filterType === "widget" ? row.widget_name : null,
        dateValues: new Map(),
        rawDates: new Map(),
      });
    }

    const group = map.get(key)!;
    const existing: RawDateComponents = group.rawDates.get(periodKey) ?? emptyRawDateComponents();

    const updated: RawDateComponents = {
      cost_spent: existing.cost_spent + (row.cost_spent ?? 0),
      ad_revenue: existing.ad_revenue + (row.ad_revenue ?? 0),
      imp: existing.imp + (row.imp ?? 0),
      vimp: existing.vimp + (row.vimp ?? 0),
      cnt_click: existing.cnt_click + (row.cnt_click ?? 0),
    };

    group.rawDates.set(periodKey, updated);
    group.dateValues.set(periodKey, computeMetricValue(updated, metricType));
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Monthly grouping
// ---------------------------------------------------------------------------

/**
 * Groups pre-aggregated monthly MV data by C/S/W granularity.
 *
 * Uses year_month as the period key (e.g. "2025-07").
 *
 * @param rawData    - Flat array of MonthlyRawRow from v_monthly
 * @param filterType - Grouping granularity: client / service / widget
 * @param metricType - Which metric to compute for dateValues
 * @returns Array of grouped rows with year_month-keyed Maps
 */
export function groupMonthlyRawData(
  rawData: MonthlyRawRow[],
  filterType: DataFilterType,
  metricType: DataMetricType,
): DataBoardGroupedRow[] {
  const map = new Map<string, DataBoardGroupedRow>();

  for (const row of rawData) {
    const key = getGroupKey(row, filterType);
    const periodKey = row.year_month;

    if (!map.has(key)) {
      map.set(key, {
        client_id: row.client_id,
        client_name: row.client_name,
        service_id: row.service_id,
        service_name: row.service_name,
        widget_id: filterType === "widget" ? row.widget_id : null,
        widget_name: filterType === "widget" ? row.widget_name : null,
        dateValues: new Map(),
        rawDates: new Map(),
      });
    }

    const group = map.get(key)!;
    const existing: RawDateComponents = group.rawDates.get(periodKey) ?? emptyRawDateComponents();

    const updated: RawDateComponents = {
      cost_spent: existing.cost_spent + (row.cost_spent ?? 0),
      ad_revenue: existing.ad_revenue + (row.ad_revenue ?? 0),
      imp: existing.imp + (row.imp ?? 0),
      vimp: existing.vimp + (row.vimp ?? 0),
      cnt_click: existing.cnt_click + (row.cnt_click ?? 0),
    };

    group.rawDates.set(periodKey, updated);
    group.dateValues.set(periodKey, computeMetricValue(updated, metricType));
  }

  return Array.from(map.values());
}
