/**
 * Reusable POST fetch wrapper functions for React Query queryFn.
 *
 * React Query passes { signal } to every queryFn for automatic
 * abort on unmount or key change — no manual AbortController needed.
 */

import type {
  DailyServiceRow,
  DailyRawRow,
  WeeklyRawRow,
  MonthlyRawRow,
} from "@/types/app-db.types";
import type { ExternalDailyRow, ExternalMappingRow, ExternalValueRow } from "@/types/external";

/**
 * Generic POST fetch that respects AbortSignal from React Query.
 */
async function postFetch<T>(
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

/** Fetch Dashboard service-level data. */
export function fetchDashboardServiceData(
  dates: string[],
  clientIds: string[] | null,
  signal: AbortSignal,
): Promise<DailyServiceRow[]> {
  return postFetch("/api/dashboard/service-data", { dates, clientIds }, signal);
}

/** Fetch Data-Board widget-level full data. */
export function fetchDataBoardFullData(
  dates: string[],
  signal: AbortSignal,
): Promise<DailyRawRow[]> {
  return postFetch("/api/data-board/full-data", { dates }, signal);
}

/** Fetch MA Charts service-level full data. */
export function fetchMaFullServiceData(
  dates: string[],
  signal: AbortSignal,
): Promise<DailyServiceRow[]> {
  return postFetch("/api/charts/ma/full-data", { dates }, signal);
}

/** Fetch MA Charts widget-level data. */
export function fetchMaWidgetData(
  dates: string[],
  signal: AbortSignal,
): Promise<DailyRawRow[]> {
  return postFetch("/api/charts/widget-data", { dates }, signal);
}

/** Fetch Data-Board weekly full data. */
export function fetchDataBoardWeeklyFullData(
  allWeeks: { year: number; weekNumber: number; label: string }[],
  signal: AbortSignal,
): Promise<WeeklyRawRow[]> {
  return postFetch("/api/data-board/weekly", { allWeeks }, signal);
}

/** Fetch Data-Board monthly full data. */
export function fetchDataBoardMonthlyFullData(
  allMonths: string[],
  signal: AbortSignal,
): Promise<MonthlyRawRow[]> {
  return postFetch("/api/data-board/monthly", { allMonths }, signal);
}

/** Fetch external daily data + mappings + unit prices + internal data. */
export function fetchExternalData(
  startDate: string,
  endDate: string,
  signal: AbortSignal,
): Promise<{
  externalRows: ExternalDailyRow[];
  mappings: ExternalMappingRow[];
  unitPrices: ExternalValueRow[];
  internalRows: DailyRawRow[];
}> {
  return postFetch("/api/external/data", { startDate, endDate }, signal);
}
