/**
 * MA Chart — mini card data building.
 */

import type {
  MaEntitySeries,
  MaMetricType,
  MaWindow,
  MaMiniCardData,
} from "./types";
import { buildMainChartData } from "./chartDataLogic";

// ---------------------------------------------------------------------------
// Mini card data
// ---------------------------------------------------------------------------

/**
 * Builds mini card data for the top N ranked entities.
 */
export function buildMiniCardsData(
  grouped: Map<string, MaEntitySeries>,
  rankedIds: string[],
  metric: MaMetricType,
  allSortedDates: string[],
  displayDates: string[],
  maWindow: MaWindow,
  holidaySet: Set<string>,
  includeHolidays: boolean,
  count: number,
): MaMiniCardData[] {
  const displaySet = new Set(displayDates);
  const ids = rankedIds.slice(0, count);

  return ids.map((id) => {
    const entity = grouped.get(id)!;
    const chartPoints = buildMainChartData(
      entity,
      metric,
      allSortedDates,
      displayDates,
      maWindow,
      holidaySet,
      includeHolidays,
    );

    // Sum ad_revenue in display range for ranking badge
    let adRevenueSum = 0;
    for (const [date, data] of entity.dailyData) {
      if (displaySet.has(date)) adRevenueSum += data.ad_revenue;
    }

    // Latest values from the last chart point
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
      latestMa: last?.ma ?? null,
      latestGap: last?.gap ?? null,
    };
  });
}
