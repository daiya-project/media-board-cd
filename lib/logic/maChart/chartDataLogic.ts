/**
 * MA Chart — metric computation, band building, and chart data construction.
 */

import { sma } from "@/lib/logic/chartsLogic";
import type {
  MaEntityDailyData,
  MaEntitySeries,
  MaMetricType,
  MaWindow,
  MaChartDataPoint,
} from "./types";
import { dateLabelMD } from "./types";

// ---------------------------------------------------------------------------
// Metric computation
// ---------------------------------------------------------------------------

/**
 * Computes a single metric value from raw daily components.
 */
export function computeMetric(raw: MaEntityDailyData, metric: MaMetricType): number {
  switch (metric) {
    case "ad_revenue":
      return raw.ad_revenue;
    case "vimp":
      return raw.vimp;
    case "mfr":
      return raw.cost_spent > 0
        ? (raw.ad_revenue / raw.cost_spent) * 100
        : 0;
    case "vctr":
      return raw.vimp > 0 ? (raw.cnt_click / raw.vimp) * 100 : 0;
    case "vrate":
      return raw.imp > 0 ? (raw.vimp / raw.imp) * 100 : 0;
  }
}

// ---------------------------------------------------------------------------
// Band building (internal)
// ---------------------------------------------------------------------------

/**
 * Builds band arrays for the Area components.
 * redBand = area where actual > ma; blueBand = area where actual < ma.
 */
function buildBands(
  actual: number | null,
  ma: number | null,
): { redBand: [number, number]; blueBand: [number, number] } {
  if (actual == null || ma == null) {
    const val = ma ?? actual ?? 0;
    return { redBand: [val, val], blueBand: [val, val] };
  }
  if (actual > ma) {
    return { redBand: [ma, actual], blueBand: [ma, ma] };
  }
  if (actual < ma) {
    return { redBand: [ma, ma], blueBand: [actual, ma] };
  }
  return { redBand: [ma, ma], blueBand: [ma, ma] };
}

// ---------------------------------------------------------------------------
// Main chart data
// ---------------------------------------------------------------------------

/**
 * Builds main chart data for a single entity.
 * Uses allSortedDates for MA warmup, returns only displayDates portion.
 */
export function buildMainChartData(
  entity: MaEntitySeries,
  metric: MaMetricType,
  allSortedDates: string[],
  displayDates: string[],
  maWindow: MaWindow,
  holidaySet: Set<string>,
  includeHolidays: boolean,
): MaChartDataPoint[] {
  // Filter dates by holiday setting
  const effectiveDates = includeHolidays
    ? allSortedDates
    : allSortedDates.filter((d) => !holidaySet.has(d));

  // Extract metric values for the full range
  const values: (number | null)[] = effectiveDates.map((d) => {
    const raw = entity.dailyData.get(d);
    return raw ? computeMetric(raw, metric) : null;
  });

  // Replace nulls with 0 for SMA (treat missing data as 0)
  const numericValues = values.map((v) => v ?? 0);
  const maValues = sma(numericValues, maWindow);

  // Build display set for filtering
  const effectiveDisplayDates = includeHolidays
    ? displayDates
    : displayDates.filter((d) => !holidaySet.has(d));
  const effectiveDisplaySet = new Set(effectiveDisplayDates);

  const points: MaChartDataPoint[] = [];
  for (let i = 0; i < effectiveDates.length; i++) {
    const date = effectiveDates[i];
    if (!effectiveDisplaySet.has(date)) continue;

    const actual = values[i];
    const ma = maValues[i];
    const gap =
      actual != null && ma != null && ma !== 0
        ? ((actual - ma) / ma) * 100
        : null;
    const bands = buildBands(actual, ma);

    points.push({
      date,
      label: dateLabelMD(date),
      actual,
      ma,
      gap,
      ...bands,
      isHoliday: holidaySet.has(date),
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Aggregated chart data
// ---------------------------------------------------------------------------

/**
 * Builds aggregated chart data across all entities.
 * Used when no entity is selected (shows total).
 */
export function buildAggregatedChartData(
  grouped: Map<string, MaEntitySeries>,
  metric: MaMetricType,
  allSortedDates: string[],
  displayDates: string[],
  maWindow: MaWindow,
  holidaySet: Set<string>,
  includeHolidays: boolean,
): MaChartDataPoint[] {
  // Sum raw components across all entities per date
  const aggregated = new Map<string, MaEntityDailyData>();
  for (const date of allSortedDates) {
    const sum: MaEntityDailyData = {
      cost_spent: 0,
      ad_revenue: 0,
      imp: 0,
      vimp: 0,
      cnt_click: 0,
    };
    for (const series of grouped.values()) {
      const raw = series.dailyData.get(date);
      if (raw) {
        sum.cost_spent += raw.cost_spent;
        sum.ad_revenue += raw.ad_revenue;
        sum.imp += raw.imp;
        sum.vimp += raw.vimp;
        sum.cnt_click += raw.cnt_click;
      }
    }
    aggregated.set(date, sum);
  }

  // Build a synthetic entity from the aggregate
  const syntheticEntity: MaEntitySeries = {
    entityId: "__aggregate__",
    entityName: "전체",
    clientId: "",
    clientName: "",
    serviceId: "",
    serviceName: "",
    dailyData: aggregated,
  };

  return buildMainChartData(
    syntheticEntity,
    metric,
    allSortedDates,
    displayDates,
    maWindow,
    holidaySet,
    includeHolidays,
  );
}
