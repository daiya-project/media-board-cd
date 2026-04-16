/**
 * Board (Dashboard) section — business logic — barrel re-export.
 *
 * Implementation split into:
 *   - board/types.ts        — PeriodType, ChartGroup, PeriodDateRanges, shared helpers
 *   - board/summaryLogic.ts — KPI summary + aggregation
 *   - board/chartLogic.ts   — chart data + period date ranges
 *   - board/trendLogic.ts   — trend ranking
 */

export type { PeriodType, ChartGroup, PeriodDateRanges } from "./board/types";
export { aggregateServiceToTotal, calcBoardSummaryByDateRange } from "./board/summaryLogic";
export { getPeriodDateRanges, calcChartPointsByGroups } from "./board/chartLogic";
export { calcTrendListByDateRange, type TrendMetric } from "./board/trendLogic";
