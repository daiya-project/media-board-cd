/**
 * DATA Monthly section data-fetching service.
 *
 * Phase 2: first 3 months from v_monthly MV.
 * Phase 3: all months via React Query background fetch.
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { mapBaseMetrics, mapClientService, mapWidget } from "@/lib/api/rowMappers";
import { paginateQuery } from "@/lib/api/paginateQuery";
import { getClientMeta } from "./shared";
import type { MonthlyPayload, MonthlyRawRow } from "@/types/app-db.types";

/** Number of initial months to fetch in Monthly Phase 2 quick payload. */
const INITIAL_MONTHS = 3;

// ---------------------------------------------------------------------------
// getMonthlyAllPeriods
// ---------------------------------------------------------------------------

/**
 * Fetches all distinct year_month values from media.v_monthly_periods view,
 * ordered newest first.
 *
 * Uses a dedicated DISTINCT view instead of scanning the full v_monthly MV
 * (26k+ rows) — reduces query from ~26 pagination rounds to a single fetch.
 *
 * @returns Array of year_month strings (YYYY-MM), newest first.
 * @throws Supabase error if the query fails.
 */
export async function getMonthlyAllPeriods(): Promise<string[]> {
  const supabase = await createMediaClient();

  const { data, error } = await supabase
    .from("v_monthly_periods")
    .select("year_month")
    .order("year_month", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as Array<{ year_month: string }>).map((r) => r.year_month);
}

// ---------------------------------------------------------------------------
// getMonthlyRawData (internal)
// ---------------------------------------------------------------------------

/**
 * Fetches raw monthly rows from media.v_monthly for the given months.
 *
 * Fires one query per month in parallel with `.range()` pagination.
 *
 * @param months - Array of year_month strings (YYYY-MM) to fetch.
 * @returns Flat array of MonthlyRawRow (all months combined).
 * @throws Supabase error if any per-month query fails.
 */
async function getMonthlyRawData(
  months: string[],
): Promise<MonthlyRawRow[]> {
  if (months.length === 0) return [];

  const supabase = await createMediaClient();

  const cols =
    "year_month, client_id, client_name, service_id, service_name, " +
    "widget_id, widget_name, cost_spent, ad_revenue, imp, vimp, cnt_click";

  async function fetchMonth(yearMonth: string): Promise<MonthlyRawRow[]> {
    return paginateQuery(
      (offset, bs) =>
        supabase
          .from("v_monthly")
          .select(cols)
          .eq("year_month", yearMonth)
          .order("client_id", { ascending: true })
          .range(offset, offset + bs - 1) as never,
      (row) => ({
        year_month: row.year_month as string,
        ...mapClientService(row),
        ...mapWidget(row),
        ...mapBaseMetrics(row),
      }),
    );
  }

  const results = await Promise.all(months.map(fetchMonth));
  return results.flat();
}

// ---------------------------------------------------------------------------
// getMonthlyQuickPayload  (Phase 2 — awaited by page.tsx)
// ---------------------------------------------------------------------------

/**
 * Phase 2 quick payload for the Monthly DATA page.
 *
 * @returns Serializable MonthlyPayload with initial monthly data.
 * @throws Supabase / network error if any sub-query fails.
 */
export async function getMonthlyQuickPayload(): Promise<MonthlyPayload> {
  const allMonths = await getMonthlyAllPeriods();

  if (allMonths.length === 0) {
    return { allMonths: [], rawData: [], clientMeta: [] };
  }

  const initialMonths = allMonths.slice(0, INITIAL_MONTHS);
  const [rawData, clientMeta] = await Promise.all([
    getMonthlyRawData(initialMonths),
    getClientMeta(),
  ]);

  return { allMonths, rawData, clientMeta };
}

// ---------------------------------------------------------------------------
// getMonthlyFullData  (Phase 3 — NOT awaited, Promise passed to client)
// ---------------------------------------------------------------------------

/**
 * Phase 3 fetch: returns monthly raw data for ALL available months.
 *
 * @param allMonths - Full array of year_month strings from the quick payload.
 * @returns Flat array of MonthlyRawRow (all months).
 * @throws Supabase error if any per-month query fails.
 */
export async function getMonthlyFullData(
  allMonths: string[],
): Promise<MonthlyRawRow[]> {
  if (allMonths.length === 0) return [];
  return getMonthlyRawData(allMonths);
}
