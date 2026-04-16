/**
 * Data Chart business logic.
 *
 * Structurally mirrors maChartLogic but without moving-average (SMA),
 * gap calculation, or red/blue band computation. Displays raw actual
 * metric values as a time-series.
 *
 * Shared utilities (groupByEntity, rankEntitiesByRevenue, computeDisplayDates,
 * metric constants) are imported from maChartLogic to avoid duplication.
 */

import {
  computeMetric,
  dateLabelMD,
  type MaMetricType,
  type MaEntitySeries,
} from "@/lib/logic/maChartLogic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single data point for the Data Chart (no MA, bands, or gap). */
export interface DataChartDataPoint {
  date: string;
  label: string; // MM/DD
  actual: number | null;
  secondary: number | null;
  isHoliday: boolean;
}

/** Mini card data for the Data Chart (no latestMa or latestGap). */
export interface DataMiniCardData {
  entityId: string;
  entityName: string;
  clientId: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  adRevenueSum: number;
  chartPoints: DataChartDataPoint[];
  latestActual: number | null;
}

// ---------------------------------------------------------------------------
// Chart data building
// ---------------------------------------------------------------------------

/**
 * Builds main chart data for a single entity — raw actual values only.
 *
 * Uses allSortedDates for the full date range, returns only the
 * displayDates portion. Holiday filtering mirrors buildMainChartData.
 */
export function buildDataChartData(
  entity: MaEntitySeries,
  metric: MaMetricType,
  allSortedDates: string[],
  displayDates: string[],
  holidaySet: Set<string>,
  includeHolidays: boolean,
  secondaryMetric?: MaMetricType | null,
): DataChartDataPoint[] {
  // Filter dates by holiday setting
  const effectiveDates = includeHolidays
    ? allSortedDates
    : allSortedDates.filter((d) => !holidaySet.has(d));

  // Extract metric values
  const values: (number | null)[] = effectiveDates.map((d) => {
    const raw = entity.dailyData.get(d);
    return raw ? computeMetric(raw, metric) : null;
  });

  // Extract secondary metric values
  const secondaryValues: (number | null)[] = secondaryMetric
    ? effectiveDates.map((d) => {
        const raw = entity.dailyData.get(d);
        return raw ? computeMetric(raw, secondaryMetric) : null;
      })
    : effectiveDates.map(() => null);

  // Build display set
  const effectiveDisplayDates = includeHolidays
    ? displayDates
    : displayDates.filter((d) => !holidaySet.has(d));
  const effectiveDisplaySet = new Set(effectiveDisplayDates);

  const points: DataChartDataPoint[] = [];
  for (let i = 0; i < effectiveDates.length; i++) {
    const date = effectiveDates[i];
    if (!effectiveDisplaySet.has(date)) continue;

    points.push({
      date,
      label: dateLabelMD(date),
      actual: values[i],
      secondary: secondaryValues[i],
      isHoliday: holidaySet.has(date),
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Mini card data
// ---------------------------------------------------------------------------

/**
 * Builds mini card data for the top N ranked entities.
 */
export function buildDataMiniCardsData(
  grouped: Map<string, MaEntitySeries>,
  rankedIds: string[],
  metric: MaMetricType,
  allSortedDates: string[],
  displayDates: string[],
  holidaySet: Set<string>,
  includeHolidays: boolean,
  count: number,
): DataMiniCardData[] {
  const displaySet = new Set(displayDates);
  const ids = rankedIds.slice(0, count);

  return ids.map((id) => {
    const entity = grouped.get(id)!;
    const chartPoints = buildDataChartData(
      entity,
      metric,
      allSortedDates,
      displayDates,
      holidaySet,
      includeHolidays,
    );

    // Sum ad_revenue in display range
    let adRevenueSum = 0;
    for (const [date, data] of entity.dailyData) {
      if (displaySet.has(date)) adRevenueSum += data.ad_revenue;
    }

    // Latest value from the last chart point
    const last = chartPoints[chartPoints.length - 1] ?? null;

    return {
      entityId: id,
      entityName: entity.entityName,
      clientId: entity.clientId,
      clientName: entity.clientName,
      serviceId: entity.serviceId,
      serviceName: entity.serviceName,
      adRevenueSum,
      chartPoints,
      latestActual: last?.actual ?? null,
    };
  });
}
