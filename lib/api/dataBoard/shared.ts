/**
 * Shared helpers for DATA section data-fetching services.
 *
 * Used by dailyService, weeklyService, monthlyService.
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { paginateQuery } from "@/lib/api/paginateQuery";
import type { ClientMeta, DataFilterType } from "@/types/app-db.types";

/** Number of distinct dates to fetch (covers up to ~3 months / 12 weeks). */
export const DATE_COUNT = 90;

/**
 * Returns the DB view name and SELECT column list for the given filter granularity.
 *
 * - "service" / "client" → v_daily_by_service (Materialized View, ~50 rows/day)
 * - "widget"             → v_daily (widget-level, ~200 rows/day)
 *
 * @param filterType - Granularity to query
 */
export function getViewAndCols(filterType: DataFilterType): { view: string; cols: string } {
  const base =
    "date, client_id, client_name, service_id, service_name, " +
    "cost_spent, ad_revenue, imp, vimp, cnt_click";
  if (filterType === "widget") {
    return { view: "v_daily", cols: base + ", widget_id, widget_name" };
  }
  return { view: "v_daily_by_service", cols: base };
}

/**
 * Returns the n most-recent distinct dates from media.v_dates, newest first.
 *
 * v_dates is already ORDER BY date DESC, so the first row IS the latest date.
 * No separate getLatestDataDate() call needed — eliminates 1 sequential HTTP
 * request from the critical path.
 *
 * @param n - Number of distinct dates to collect (default 90)
 * @returns Array of date strings (YYYY-MM-DD), newest first.
 * @throws Supabase error if any query fails.
 */
export async function getDataBoardDates(n = DATE_COUNT): Promise<string[]> {
  const supabase = await createMediaClient();

  const { data, error } = await supabase
    .from("v_dates")
    .select("date")
    .limit(n);

  if (error) throw error;

  return ((data ?? []) as Array<{ date: string }>).map((r) => r.date);
}

/**
 * Fetches lightweight client metadata (tier, manager_id) for all active clients.
 * Used for client-side tier/owner filtering in DATA and CVR sections.
 *
 * @returns Array of ClientMeta objects.
 * @throws Supabase error if the query fails.
 */
export async function getClientMeta(): Promise<ClientMeta[]> {
  const supabase = await createMediaClient();

  return paginateQuery(
    (offset, bs) =>
      supabase
        .from("client")
        .select("client_id, tier, manager_id")
        .eq("is_active", true)
        .order("client_id", { ascending: true })
        .range(offset, offset + bs - 1) as never,
    (row) => ({
      client_id: String(row.client_id),
      tier: row.tier != null ? String(row.tier) : null,
      manager_id: row.manager_id != null ? Number(row.manager_id) : null,
    }),
  );
}

/**
 * Fetches public holidays from media.ref_holiday within the given date range
 * and adds all weekend dates (Sat/Sun) in the same range.
 *
 * @param startDate - Range start, inclusive (YYYY-MM-DD)
 * @param endDate   - Range end, inclusive (YYYY-MM-DD)
 * @returns Deduplicated array of holiday + weekend date strings (YYYY-MM-DD)
 */
export async function getHolidays(
  startDate: string,
  endDate: string,
): Promise<string[]> {
  const supabase = await createMediaClient();

  const { data, error } = await supabase
    .from("ref_holiday")
    .select("id")
    .gte("id", startDate)
    .lte("id", endDate);

  if (error) throw error;

  const result = new Set<string>(
    ((data ?? []) as Array<{ id: string }>).map((r) => r.id),
  );

  // Add all weekend dates in the range
  const cursor = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  while (cursor <= end) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) {
      result.add(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return Array.from(result);
}
