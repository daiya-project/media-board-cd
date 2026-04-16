/**
 * Data-Board grouping — shared internal helpers.
 *
 * Used across dailyGrouping, periodGrouping, and buildTotalRow.
 */

import type { RawDateComponents, DataFilterType, DataMetricType } from "@/types/app-db.types";

/** Creates a zeroed RawDateComponents value for accumulation. */
export function emptyRawDateComponents(): RawDateComponents {
  return { cost_spent: 0, ad_revenue: 0, imp: 0, vimp: 0, cnt_click: 0 };
}

/**
 * Returns the grouping key for a row based on filter type.
 * Works with any row shape that has client_id, service_id, and widget_id.
 */
export function getGroupKey(
  row: { client_id: string; service_id: string; widget_id?: string | null },
  filterType: DataFilterType,
): string {
  switch (filterType) {
    case "client":
      return row.client_id;
    case "service":
      return `${row.client_id}-${row.service_id}`;
    case "widget":
      return `${row.client_id}-${row.service_id}-${row.widget_id ?? ""}`;
  }
}

/**
 * Computes the display metric value from accumulated raw components.
 *
 * For ratio types, the value is recalculated from summed numerator/denominator
 * rather than averaged from individual ratios (which would produce incorrect results
 * when the denominators differ across rows).
 */
export function computeMetricValue(
  raw: RawDateComponents,
  metricType: DataMetricType,
): number {
  switch (metricType) {
    case "adrevenue":
      return raw.cost_spent;
    case "pubprofit":
      return raw.ad_revenue;
    case "mfr":
      return raw.cost_spent > 0
        ? (raw.ad_revenue / raw.cost_spent) * 100
        : 0;
    case "imp":
      return raw.imp;
    case "vimp":
      return raw.vimp;
    case "vrate":
      return raw.imp > 0 ? (raw.vimp / raw.imp) * 100 : 0;
    case "vctr":
      return raw.vimp > 0 ? (raw.cnt_click / raw.vimp) * 100 : 0;
  }
}
