/**
 * DATA section data-fetching service — barrel re-export.
 *
 * Implementation split into:
 *   - dataBoard/shared.ts        — getHolidays, getDataBoardDates, getViewAndCols
 *   - dataBoard/dailyService.ts  — Daily Phase 2/3
 *   - dataBoard/weeklyService.ts — Weekly Phase 2/3
 *   - dataBoard/monthlyService.ts — Monthly Phase 2/3
 */

export { getHolidays, getDataBoardDates, getClientMeta } from "./dataBoard/shared";
export { getDataBoardQuickPayload, getDataBoardFullData } from "./dataBoard/dailyService";
export { getWeeklyAllPeriods, getWeeklyQuickPayload, getWeeklyFullData } from "./dataBoard/weeklyService";
export { getMonthlyAllPeriods, getMonthlyQuickPayload, getMonthlyFullData } from "./dataBoard/monthlyService";
