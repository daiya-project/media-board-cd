/**
 * Data-Board grouping — daily grouping and total row builder.
 */

import type {
  DailyRawRow,
  DataFilterType,
  DataMetricType,
  DataBoardGroupedRow,
  RawDateComponents,
} from "@/types/app-db.types";
import { computeMetricValue, getGroupKey, emptyRawDateComponents } from "./shared";

// ---------------------------------------------------------------------------
// Daily grouping
// ---------------------------------------------------------------------------

/**
 * Groups raw daily data by the specified filter granularity and computes
 * per-date metric values for each group.
 *
 * For each group:
 *   - `rawDates` accumulates the raw numeric components per date (for ratio recalc)
 *   - `dateValues` stores the computed display value per date
 *
 * @param rawData    - Flat array of raw rows from media.v_daily
 * @param filterType - Grouping granularity: client / service / widget
 * @param metricType - Which metric to compute for dateValues
 * @returns Array of grouped rows with dateValues and rawDates Maps
 */
export function groupRawData(
  rawData: DailyRawRow[],
  filterType: DataFilterType,
  metricType: DataMetricType,
): DataBoardGroupedRow[] {
  const map = new Map<string, DataBoardGroupedRow>();

  for (const row of rawData) {
    const key = getGroupKey(row, filterType);

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
    const existing: RawDateComponents = group.rawDates.get(row.date) ?? emptyRawDateComponents();

    const updated: RawDateComponents = {
      cost_spent: existing.cost_spent + (row.cost_spent ?? 0),
      ad_revenue: existing.ad_revenue + (row.ad_revenue ?? 0),
      imp: existing.imp + (row.imp ?? 0),
      vimp: existing.vimp + (row.vimp ?? 0),
      cnt_click: existing.cnt_click + (row.cnt_click ?? 0),
    };

    group.rawDates.set(row.date, updated);
    group.dateValues.set(row.date, computeMetricValue(updated, metricType));
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Total row builder
// ---------------------------------------------------------------------------

export interface TotalRowData {
  totalDateValues: Map<string, number>;
  totalRawDates: Map<string, RawDateComponents>;
}

/**
 * Computes the aggregated total across all filtered rows for each date.
 * Used to render the pinned "합계" (total) row at the top of the table.
 *
 * @param filteredRows - The currently visible (filtered) grouped rows
 * @param dates        - Ordered date array (newest first)
 * @param metricType   - Metric type for recomputing display values
 * @returns Total date values and raw components for all dates
 */
export function buildTotalRow(
  filteredRows: DataBoardGroupedRow[],
  dates: string[],
  metricType: DataMetricType,
): TotalRowData {
  const totalRawDates = new Map<string, RawDateComponents>();
  const totalDateValues = new Map<string, number>();

  for (const date of dates) {
    const rawTotal: RawDateComponents = emptyRawDateComponents();

    for (const row of filteredRows) {
      const raw = row.rawDates.get(date);
      if (!raw) continue;
      rawTotal.cost_spent += raw.cost_spent;
      rawTotal.ad_revenue += raw.ad_revenue;
      rawTotal.imp += raw.imp;
      rawTotal.vimp += raw.vimp;
      rawTotal.cnt_click += raw.cnt_click;
    }

    totalRawDates.set(date, rawTotal);
    totalDateValues.set(date, computeMetricValue(rawTotal, metricType));
  }

  return { totalDateValues, totalRawDates };
}
