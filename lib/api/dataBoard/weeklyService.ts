/**
 * DATA Weekly section data-fetching service.
 *
 * Phase 2: first 8 weeks from v_weekly MV.
 * Phase 3: all weeks via React Query background fetch.
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { mapBaseMetrics, mapClientService, mapWidget } from "@/lib/api/rowMappers";
import { paginateQuery } from "@/lib/api/paginateQuery";
import { getHolidays, getClientMeta } from "./shared";
import type { WeeklyPayload, WeeklyRawRow } from "@/types/app-db.types";

/** Number of initial weeks to fetch in Weekly Phase 2 quick payload. */
const INITIAL_WEEKS = 8;

// ---------------------------------------------------------------------------
// getWeeklyAllPeriods
// ---------------------------------------------------------------------------

/**
 * Fetches all distinct (year, week_number, display_label) from
 * media.v_weekly_periods view, ordered newest first.
 *
 * Uses a dedicated DISTINCT view instead of scanning the full v_weekly MV
 * (102k+ rows) — reduces query from ~103 pagination rounds to a single fetch.
 *
 * @returns Array of week descriptors, newest first.
 * @throws Supabase error if the query fails.
 */
export async function getWeeklyAllPeriods(): Promise<
  { year: number; weekNumber: number; label: string }[]
> {
  const supabase = await createMediaClient();

  const { data, error } = await supabase
    .from("v_weekly_periods")
    .select("year, week_number, display_label")
    .order("year", { ascending: false })
    .order("week_number", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as Array<{ year: number; week_number: number; display_label: string }>).map(
    (r) => ({
      year: r.year,
      weekNumber: r.week_number,
      label: r.display_label,
    }),
  );
}

// ---------------------------------------------------------------------------
// getWeeklyRawData (internal)
// ---------------------------------------------------------------------------

/**
 * Fetches raw weekly rows from media.v_weekly for the given weeks.
 *
 * Fires one query per week in parallel with `.range()` pagination.
 *
 * @param weeks - Array of { year, weekNumber } to fetch.
 * @param limit - Optional max number of weeks to fetch.
 * @returns Flat array of WeeklyRawRow (all weeks combined).
 * @throws Supabase error if any per-week query fails.
 */
async function getWeeklyRawData(
  weeks: { year: number; weekNumber: number }[],
  limit?: number,
): Promise<WeeklyRawRow[]> {
  const target = limit ? weeks.slice(0, limit) : weeks;
  if (target.length === 0) return [];

  const supabase = await createMediaClient();

  const cols =
    "year, week_number, date_start, date_end, display_label, " +
    "client_id, client_name, service_id, service_name, widget_id, widget_name, " +
    "cost_spent, ad_revenue, imp, vimp, cnt_click";

  async function fetchWeek(year: number, weekNumber: number): Promise<WeeklyRawRow[]> {
    return paginateQuery(
      (offset, bs) =>
        supabase
          .from("v_weekly")
          .select(cols)
          .eq("year", year)
          .eq("week_number", weekNumber)
          .order("client_id", { ascending: true })
          .range(offset, offset + bs - 1) as never,
      (row) => ({
        year: row.year as number,
        week_number: row.week_number as number,
        date_start: row.date_start as string,
        date_end: row.date_end as string,
        display_label: row.display_label as string,
        ...mapClientService(row),
        ...mapWidget(row),
        ...mapBaseMetrics(row),
      }),
    );
  }

  const results = await Promise.all(
    target.map((w) => fetchWeek(w.year, w.weekNumber)),
  );
  return results.flat();
}

// ---------------------------------------------------------------------------
// getWeeklyQuickPayload  (Phase 2 — awaited by page.tsx)
// ---------------------------------------------------------------------------

/**
 * Phase 2 quick payload for the Weekly DATA page.
 *
 * @returns Serializable WeeklyPayload with initial weekly data.
 * @throws Supabase / network error if any sub-query fails.
 */
export async function getWeeklyQuickPayload(): Promise<WeeklyPayload> {
  const allWeeks = await getWeeklyAllPeriods();

  if (allWeeks.length === 0) {
    return { allWeeks: [], rawData: [], holidays: [], clientMeta: [] };
  }

  const initialWeeks = allWeeks.slice(0, INITIAL_WEEKS);

  const [rawData, clientMeta] = await Promise.all([
    getWeeklyRawData(initialWeeks),
    getClientMeta(),
  ]);

  // Compute holiday range from fetched raw data
  let startDate = "";
  let endDate = "";
  if (rawData.length > 0) {
    const starts = rawData.map((r) => r.date_start);
    const ends = rawData.map((r) => r.date_end);
    startDate = starts.reduce((a, b) => (a < b ? a : b));
    endDate = ends.reduce((a, b) => (a > b ? a : b));
  }

  const resolvedHolidays =
    startDate && endDate ? await getHolidays(startDate, endDate) : [];

  return { allWeeks, rawData, holidays: resolvedHolidays, clientMeta };
}

// ---------------------------------------------------------------------------
// getWeeklyFullData  (Phase 3 — NOT awaited, Promise passed to client)
// ---------------------------------------------------------------------------

/**
 * Phase 3 fetch: returns weekly raw data for ALL available weeks.
 *
 * @param allWeeks - Full week descriptor array from the quick payload.
 * @returns Flat array of WeeklyRawRow (all weeks).
 * @throws Supabase error if any per-week query fails.
 */
export async function getWeeklyFullData(
  allWeeks: { year: number; weekNumber: number; label: string }[],
): Promise<WeeklyRawRow[]> {
  if (allWeeks.length === 0) return [];
  return getWeeklyRawData(allWeeks);
}
