/**
 * Business logic for Goal Monthly — projections and KPI card assembly.
 */

import type { MonthlyKpiCard } from "@/types/app-db.types";
import { parseYearMonth, addMonths } from "@/lib/utils/date-utils";

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * Projects the full-month vIMP based on the pace so far.
 *
 * @param currentVimp - vIMP accumulated so far this month
 * @param elapsedDays - number of days elapsed in the month (with data)
 * @param totalDays   - total calendar days in the month
 * @returns Projected full-month vIMP (rounded to integer)
 */
export function calcProjectedVimp(
  currentVimp: number,
  elapsedDays: number,
  totalDays: number,
): number {
  if (elapsedDays <= 0 || totalDays <= 0) return 0;
  return Math.round((currentVimp / elapsedDays) * totalDays);
}

// ---------------------------------------------------------------------------
// Gap
// ---------------------------------------------------------------------------

/**
 * Calculates the gap between team goal and sum of manager goals.
 *
 * @returns Positive = under-allocated, Negative = over-allocated
 */
export function calcGap(teamGoal: number, managerTotal: number): number {
  return teamGoal - managerTotal;
}

// ---------------------------------------------------------------------------
// KPI Cards
// ---------------------------------------------------------------------------

/**
 * Builds 4 KPI cards from monthly vimp data.
 *
 * Cards:
 *   [0] 2 months ago (actual)
 *   [1] 1 month ago  (actual)
 *   [2] Current month (actual so far)
 *   [3] Current month (projected)
 *
 * @param monthlyVimp - Map of "YYYY-MM" → vimp total
 * @param currentMonthKey - "YYYY-MM" of the current month
 * @param elapsedDays - days elapsed in the current month
 * @param totalDays - total calendar days in the current month
 * @returns Array of 4 MonthlyKpiCard
 */
export function buildKpiCards(
  monthlyVimp: Map<string, number>,
  currentMonthKey: string,
  elapsedDays: number,
  totalDays: number,
): MonthlyKpiCard[] {
  // Build 3 month keys: 2 months ago, 1 month ago, current
  const monthKeys: string[] = [];
  for (let offset = -2; offset <= 0; offset++) {
    monthKeys.push(addMonths(currentMonthKey, offset));
  }

  const cards: MonthlyKpiCard[] = [];

  for (let i = 0; i < 3; i++) {
    const key = monthKeys[i];
    const vimp = monthlyVimp.get(key) ?? 0;
    const prevKey = i > 0 ? monthKeys[i - 1] : null;
    const prevVimp = prevKey ? (monthlyVimp.get(prevKey) ?? 0) : null;

    const [, monthNum] = parseYearMonth(key);

    cards.push({
      monthKey: key,
      monthLabel: `${monthNum}월`,
      vimp,
      vimpChange: prevVimp !== null ? vimp - prevVimp : null,
      vimpChangeRate:
        prevVimp !== null && prevVimp > 0
          ? ((vimp - prevVimp) / prevVimp) * 100
          : null,
      totalClients: 0,
      activeClients: 0,
      isProjected: false,
    });
  }

  // Card [3]: projected
  const currentVimp = monthlyVimp.get(currentMonthKey) ?? 0;
  const projected = calcProjectedVimp(currentVimp, elapsedDays, totalDays);
  const prevVimp = monthlyVimp.get(monthKeys[1]) ?? 0;
  const [, currentMonthNum] = parseYearMonth(currentMonthKey);

  cards.push({
    monthKey: currentMonthKey,
    monthLabel: `${currentMonthNum}월 (예상)`,
    vimp: projected,
    vimpChange: prevVimp > 0 ? projected - prevVimp : null,
    vimpChangeRate:
      prevVimp > 0 ? ((projected - prevVimp) / prevVimp) * 100 : null,
    totalClients: 0,
    activeClients: 0,
    isProjected: true,
  });

  return cards;
}

// ---------------------------------------------------------------------------
// Cumulative Chart Data
// ---------------------------------------------------------------------------

export interface CumulativeChartPoint {
  day: number;
  actual: number | null;
  projected: number | null;
  goalLine: number | null;
}

/**
 * Builds cumulative daily vimp data for the current month chart.
 *
 * @param dailyVimp - Map of day-of-month → vimp for the current month
 * @param totalDays - total calendar days in the month
 * @param latestDay - latest day with data
 * @param monthGoal - monthly vimp goal target (0 if none)
 * @returns Array of chart points (1 per day of month)
 */
export function buildCumulativeChart(
  dailyVimp: Map<number, number>,
  totalDays: number,
  latestDay: number,
  monthGoal: number,
): CumulativeChartPoint[] {
  const points: CumulativeChartPoint[] = [];

  // First pass: accumulate actuals
  const actualCumulative: number[] = [];
  let runningTotal = 0;
  for (let day = 1; day <= totalDays; day++) {
    runningTotal += dailyVimp.get(day) ?? 0;
    actualCumulative.push(runningTotal);
  }

  const latestCumulative = latestDay > 0 ? actualCumulative[latestDay - 1] : 0;
  const pace = latestDay > 0 ? latestCumulative / latestDay : 0;

  // Goal line: linear from 0 to monthGoal across the month
  for (let day = 1; day <= totalDays; day++) {
    const hasData = day <= latestDay;

    points.push({
      day,
      actual: hasData ? actualCumulative[day - 1] : null,
      projected: day >= latestDay
        ? (hasData ? actualCumulative[day - 1] : latestCumulative + pace * (day - latestDay))
        : null,
      goalLine: monthGoal > 0 ? Math.round((monthGoal / totalDays) * day) : null,
    });
  }

  return points;
}
