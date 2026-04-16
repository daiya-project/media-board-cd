/**
 * DATA Daily section data-fetching service.
 *
 * Two-phase loading:
 *   Phase 2 (await):  v_daily_by_service × 14 days → immediate S/C mode render
 *   Phase 3 (Promise): v_daily × 90 days → replaces Phase 2, enables all modes
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { mapBaseMetrics, mapClientService, mapWidget } from "@/lib/api/rowMappers";
import { paginateQuery } from "@/lib/api/paginateQuery";
import { getViewAndCols, getDataBoardDates, getHolidays, getClientMeta } from "./shared";
import type {
  DailyRawRow,
  DataBoardPayload,
  DataFilterType,
} from "@/types/app-db.types";

/** Number of initial dates to fetch in Phase 2 (matches daily default chartRange). */
const INITIAL_DAYS = 14;

// ---------------------------------------------------------------------------
// getRawDailyData (internal)
// ---------------------------------------------------------------------------

/**
 * Fetches all raw daily rows for the given dates from the specified view.
 *
 * Fires one query per date in parallel. Each single-date `.eq("date", date)`
 * uses the idx_daily_date index directly. Total wall-clock time ≈ slowest
 * single query (not the sum).
 *
 * @param dates      - Array of date strings to fetch (YYYY-MM-DD[])
 * @param filterType - Granularity — selects the DB view to query
 * @returns Flat array of raw daily rows (all dates combined)
 * @throws Supabase error if any per-date query fails
 */
async function getRawDailyData(
  dates: string[],
  filterType: DataFilterType,
): Promise<DailyRawRow[]> {
  const supabase = await createMediaClient();
  const { view, cols } = getViewAndCols(filterType);

  async function fetchDate(date: string): Promise<DailyRawRow[]> {
    return paginateQuery(
      (offset, bs) =>
        supabase
          .from(view)
          .select(cols)
          .eq("date", date)
          .order("client_id", { ascending: true })
          .range(offset, offset + bs - 1) as never,
      (r) => ({
        date: r.date as string,
        ...mapClientService(r),
        ...mapWidget(r),
        ...mapBaseMetrics(r),
      }),
    );
  }

  // All dates run in parallel — total time ≈ slowest single-date query
  const results = await Promise.all(dates.map(fetchDate));
  return results.flat();
}

// ---------------------------------------------------------------------------
// getRawDailyDataBatch (internal — Phase 2 single-query fetch)
// ---------------------------------------------------------------------------

/**
 * Fetches raw daily rows for a small date set using paginated queries.
 *
 * Uses `.in("date", dates)` with paginateQuery to ensure no data is
 * truncated when results exceed 1000 rows.
 *
 * @param dates      - Array of date strings to fetch (YYYY-MM-DD[])
 * @param filterType - Granularity — selects the DB view to query
 * @returns Flat array of raw daily rows
 * @throws Supabase error if the query fails
 */
async function getRawDailyDataBatch(
  dates: string[],
  filterType: DataFilterType,
): Promise<DailyRawRow[]> {
  const supabase = await createMediaClient();
  const { view, cols } = getViewAndCols(filterType);

  return paginateQuery(
    (offset, bs) =>
      supabase
        .from(view)
        .select(cols)
        .in("date", dates)
        .order("date", { ascending: false })
        .order("client_id", { ascending: true })
        .range(offset, offset + bs - 1) as never,
    (row) => ({
      date: row.date as string,
      ...mapClientService(row),
      ...mapWidget(row),
      ...mapBaseMetrics(row),
    }),
  );
}

// ---------------------------------------------------------------------------
// getDataBoardQuickPayload  (Phase 2 — awaited by page.tsx)
// ---------------------------------------------------------------------------

/**
 * Phase 2 payload: fetches service-level data for the first INITIAL_DAYS so
 * the table can render immediately in S/C mode.
 *
 * @returns Serializable quick payload with service-level initial data.
 * @throws Supabase / network error if any sub-query fails.
 */
export async function getDataBoardQuickPayload(): Promise<DataBoardPayload> {
  const allDates = await getDataBoardDates();

  if (allDates.length === 0) {
    return { allDates: [], rawData: [], holidays: [], clientMeta: [] };
  }

  const initialDates = allDates.slice(0, INITIAL_DAYS);
  const startDate = allDates[allDates.length - 1];
  const endDate = allDates[0];

  const [rawData, holidays, clientMeta] = await Promise.all([
    getRawDailyDataBatch(initialDates, "service"),
    getHolidays(startDate, endDate),
    getClientMeta(),
  ]);

  return { allDates, rawData, holidays, clientMeta };
}

// ---------------------------------------------------------------------------
// getDataBoardFullData  (Phase 3 — NOT awaited, Promise passed to client)
// ---------------------------------------------------------------------------

/**
 * Phase 3 fetch: returns widget-level raw data for ALL 90 dates.
 *
 * @param allDates - Full 90-date array from the quick payload
 * @returns Flat array of widget-level raw daily rows (all 90 dates)
 * @throws Supabase error if any per-date query fails
 */
export async function getDataBoardFullData(
  allDates: string[],
): Promise<DailyRawRow[]> {
  if (allDates.length === 0) return [];
  return getRawDailyData(allDates, "widget");
}
