/**
 * Data-Board grouping logic — barrel re-export.
 *
 * Implementation split into:
 *   - dataBoard/shared.ts         — computeMetricValue (internal helper)
 *   - dataBoard/dailyGrouping.ts  — groupRawData, buildTotalRow, TotalRowData
 *   - dataBoard/periodGrouping.ts — groupWeeklyRawData, groupMonthlyRawData
 */

export { groupRawData, buildTotalRow, type TotalRowData } from "./dataBoard/dailyGrouping";
export { groupWeeklyRawData, groupMonthlyRawData } from "./dataBoard/periodGrouping";
