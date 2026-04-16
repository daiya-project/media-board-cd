/**
 * maChartLogic.ts — Moving Average chart calculations — barrel re-export.
 *
 * Implementation split into:
 *   - maChart/types.ts          — types, constants, formatters
 *   - maChart/entityLogic.ts    — groupByEntity, rankEntitiesByRevenue, computeDisplayDates
 *   - maChart/chartDataLogic.ts — computeMetric, buildBands, buildMainChartData, buildAggregatedChartData
 *   - maChart/miniCardLogic.ts  — buildMiniCardsData
 */

export type {
  MaMetricType,
  MaWindow,
  MaDateRange,
  MaEntityDailyData,
  MaEntitySeries,
  MaChartDataPoint,
  MaMiniCardData,
} from "./maChart/types";
export {
  MA_METRICS,
  MA_METRIC_COLORS,
  MA_METRIC_LABELS,
  MA_WINDOWS,
  MA_DATE_RANGES,
  MA_YAXIS_FORMATTERS,
  MA_METRIC_FORMATTERS,
  formatGapPct,
  gapColorClass,
  dateLabelMD,
} from "./maChart/types";
export {
  groupByEntity,
  rankEntitiesByRevenue,
  computeDisplayDates,
} from "./maChart/entityLogic";
export {
  computeMetric,
  buildMainChartData,
  buildAggregatedChartData,
} from "./maChart/chartDataLogic";
export { buildMiniCardsData } from "./maChart/miniCardLogic";
