/**
 * Board (Dashboard) — chart data and period date range calculation.
 */

import type {
  DailyTotalRow,
  DailyServiceRow,
  BoardChartPoint,
  RefWeekRow,
} from "@/types/app-db.types";
import {
  type PeriodType,
  type ChartGroup,
  type PeriodDateRanges,
  calcMfr,
  aggregateTotalRows,
} from "./types";
import { toYearMonth } from "@/lib/utils/date-utils";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Formats a month label: "M월". */
function monthLabel(yearMonth: string): string {
  const month = parseInt(yearMonth.slice(5), 10);
  return `${month}월`;
}

/**
 * Groups dates by ref_week entries.
 * Each date is assigned to the week whose date_start <= date <= date_end.
 */
function groupDatesByRefWeek(
  allDates: string[],
  weeks: RefWeekRow[],
): Map<number, { week: RefWeekRow; dates: string[] }> {
  const result = new Map<number, { week: RefWeekRow; dates: string[] }>();

  for (const date of allDates) {
    const match = weeks.find(
      (w) => w.date_start <= date && date <= w.date_end,
    );
    if (!match) continue;

    if (!result.has(match.id)) {
      result.set(match.id, { week: match, dates: [] });
    }
    result.get(match.id)!.dates.push(date);
  }

  return result;
}

// ---------------------------------------------------------------------------
// getPeriodDateRanges
// ---------------------------------------------------------------------------

/**
 * Derives current/previous date arrays and chart groups based on period type.
 *
 * @param allDates   - All available dates, newest-first (YYYY-MM-DD[])
 * @param periodType - "daily" | "weekly" | "monthly"
 * @param chartRange - Number of periods to show in the chart
 * @param weeks      - ref_week entries from the server (newest-first); required for "weekly"
 * @returns PeriodDateRanges with currentDates, previousDates, chartGroups
 */
export function getPeriodDateRanges(
  allDates: string[],
  periodType: PeriodType,
  chartRange: number,
  weeks: RefWeekRow[] = [],
): PeriodDateRanges {
  if (allDates.length === 0) {
    return { currentDates: [], previousDates: [], chartGroups: [] };
  }

  if (periodType === "daily") {
    const currentDates = [allDates[0]];
    const previousDates = allDates[1] ? [allDates[1]] : [];
    const chartDates = allDates.slice(0, chartRange);
    const chartGroups: ChartGroup[] = [...chartDates]
      .reverse()
      .map((d) => ({ label: d, dates: [d] }));
    return { currentDates, previousDates, chartGroups };
  }

  if (periodType === "weekly") {
    const weekGroups = groupDatesByRefWeek(allDates, weeks);
    const sortedWeekIds = [...weekGroups.keys()].sort((a, b) => b - a);

    const currentId = sortedWeekIds[0];
    const previousId = sortedWeekIds[1];

    const currentDates = currentId !== undefined
      ? (weekGroups.get(currentId)?.dates ?? [])
      : [];
    const previousDates = previousId !== undefined
      ? (weekGroups.get(previousId)?.dates ?? [])
      : [];

    const chartWeekIds = sortedWeekIds.slice(0, chartRange).reverse();
    const chartGroups: ChartGroup[] = chartWeekIds.map((id) => {
      const entry = weekGroups.get(id)!;
      return {
        label: entry.week.display_label,
        dates: entry.dates,
      };
    });

    return { currentDates, previousDates, chartGroups };
  }

  // monthly
  const monthMap = new Map<string, string[]>();
  for (const d of allDates) {
    const key = toYearMonth(d);
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(d);
  }

  const monthKeys = [...monthMap.keys()].sort((a, b) => b.localeCompare(a));

  const currentKey = monthKeys[0];
  const previousKey = monthKeys[1];

  const currentDates = monthMap.get(currentKey) ?? [];
  const previousDates = previousKey ? (monthMap.get(previousKey) ?? []) : [];

  const chartMonthKeys = monthKeys.slice(0, chartRange).reverse();
  const chartGroups: ChartGroup[] = chartMonthKeys.map((key) => ({
    label: monthLabel(key),
    dates: monthMap.get(key) ?? [],
  }));

  return { currentDates, previousDates, chartGroups };
}

// ---------------------------------------------------------------------------
// calcChartPointsByGroups
// ---------------------------------------------------------------------------

/**
 * Builds chart points from pre-defined date groups.
 *
 * @param totalData         - Global daily totals
 * @param serviceData       - Service-level daily data
 * @param groups            - Ordered chart groups (oldest → newest)
 * @param selectedServiceId - Optional service_id to isolate
 * @returns Array of BoardChartPoint
 */
export function calcChartPointsByGroups(
  totalData: DailyTotalRow[],
  serviceData: DailyServiceRow[],
  groups: ChartGroup[],
  selectedServiceId: string | null,
): BoardChartPoint[] {
  if (selectedServiceId === null) {
    return groups.map(({ label, dates }) => {
      const totals = aggregateTotalRows(totalData, dates);
      return {
        date: label,
        costSpent: totals.costSpent,
        // UI 표시용 Ad Revenue = cost_spent. MFR 은 pub_profit/cost_spent.
        adRevenue: totals.costSpent,
        vimp: totals.vimp,
        mfr: calcMfr(totals.adRevenue, totals.costSpent),
      };
    });
  }

  const serviceRows = serviceData.filter(
    (r) => r.service_id === selectedServiceId,
  );

  return groups.map(({ label, dates }) => {
    const dateSet = new Set(dates);
    let costSpent = 0;
    let pubProfit = 0;
    let vimp = 0;
    for (const r of serviceRows) {
      if (!dateSet.has(r.date)) continue;
      costSpent += r.cost_spent;
      pubProfit += r.ad_revenue;
      vimp += r.vimp;
    }
    return {
      date: label,
      costSpent,
      // UI 표시용 Ad Revenue = cost_spent. MFR 은 pub_profit/cost_spent.
      adRevenue: costSpent,
      vimp,
      mfr: calcMfr(pubProfit, costSpent),
    };
  });
}
