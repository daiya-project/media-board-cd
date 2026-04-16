/**
 * Board (Dashboard) section data-fetching service.
 *
 * Reads from the `media` schema:
 *   - media.client           — advertiser master (for filter resolution)
 *   - media.v_dates          — distinct dates (fast date discovery)
 *   - media.v_daily_total    — global daily totals (KPI + overall chart)
 *   - media.v_daily_by_service — service-level daily data (trend + service chart)
 *   - media.ref_week         — organizational week definitions (shared.week view)
 *
 * Pure data-fetching; aggregation / chart calculations are handled
 * client-side in lib/logic/boardLogic.ts.
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { mapBaseMetrics, mapClientService } from "@/lib/api/rowMappers";
import { paginateQuery } from "@/lib/api/paginateQuery";
import type {
  DailyTotalRow,
  DailyServiceRow,
  BoardPayload,
  BoardQuickPayload,
  RefWeekRow,
} from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoardFilters {
  search?: string;
  tier?: string;
  /** manager_id as string (from URL params) */
  owner?: string;
}

// ---------------------------------------------------------------------------
// getFilteredClientIds
// ---------------------------------------------------------------------------

/**
 * Resolves global filter values (search, tier, owner) to a list of matching
 * client_ids. Returns null when no filters are active (= all clients pass).
 *
 * Search matches against client_id, client_name, service_id, and service_name.
 * When a search term matches a service, its parent client_id is included.
 *
 * @param filters - Global filter values from URL search params
 * @returns Filtered client_id array, or null if no filters are active
 * @throws Supabase error if the query fails
 */
export async function getFilteredClientIds(
  filters: BoardFilters,
): Promise<string[] | null> {
  const hasFilter = filters.search || filters.tier || filters.owner;
  if (!hasFilter) return null;

  const supabase = await createMediaClient();

  // Base client query — tier and owner are applied only on the client table
  let clientQuery = supabase
    .from("client")
    .select("client_id")
    .eq("is_active", true);

  if (filters.tier) {
    clientQuery = clientQuery.eq("tier", filters.tier);
  }
  if (filters.owner) {
    const ownerId = parseInt(filters.owner, 10);
    if (!isNaN(ownerId)) {
      clientQuery = clientQuery.eq("manager_id", ownerId);
    }
  }

  if (!filters.search) {
    const { data, error } = await clientQuery;
    if (error) throw error;
    return ((data ?? []) as Array<{ client_id: string }>).map((r) => r.client_id);
  }

  // When search is active, run client-side and service-side matches in parallel
  const term = `%${filters.search}%`;

  const [clientResult, serviceResult] = await Promise.all([
    // Match client_id or client_name
    clientQuery.or(`client_id.ilike.${term},client_name.ilike.${term}`),
    // Match service_id or service_name — returns client_id of the parent
    supabase
      .from("service")
      .select("client_id")
      .or(`service_id.ilike.${term},service_name.ilike.${term}`),
  ]);

  if (clientResult.error) throw clientResult.error;
  if (serviceResult.error) throw serviceResult.error;

  const ids = new Set<string>();
  ((clientResult.data ?? []) as Array<{ client_id: string }>).forEach((r) =>
    ids.add(r.client_id),
  );
  ((serviceResult.data ?? []) as Array<{ client_id: string }>).forEach((r) =>
    ids.add(r.client_id),
  );

  return Array.from(ids);
}

// ---------------------------------------------------------------------------
// getBoardAllDates (internal)
// ---------------------------------------------------------------------------

/**
 * Returns the n most-recent distinct dates from media.v_dates, newest first.
 *
 * Uses the v_dates view (SELECT DISTINCT date FROM daily) to avoid the
 * pagination loop previously needed with v_daily.
 *
 * @param n - Number of distinct dates to collect (default 90)
 * @returns Array of date strings (YYYY-MM-DD), newest first
 * @throws Supabase error if the query fails
 */
export async function getBoardAllDates(n = 90): Promise<string[]> {
  const supabase = await createMediaClient();

  const { data, error } = await supabase
    .from("v_dates")
    .select("date")
    .order("date", { ascending: false })
    .limit(n);

  if (error) throw error;

  return ((data ?? []) as Array<{ date: string }>).map((r) => r.date);
}

// ---------------------------------------------------------------------------
// getTotalData (internal)
// ---------------------------------------------------------------------------

/**
 * Fetches global daily totals from media.v_daily_total for the given dates.
 * One row per date — no pagination needed (typically 90 rows).
 *
 * @param dates - Array of date strings to fetch (YYYY-MM-DD[])
 * @returns Array of DailyTotalRow, ordered newest first
 * @throws Supabase error if the query fails
 */
async function getTotalData(dates: string[]): Promise<DailyTotalRow[]> {
  const supabase = await createMediaClient();

  const { data, error } = await supabase
    .from("v_daily_total")
    .select("date, cost_spent, ad_revenue, imp, vimp, cnt_click")
    .in("date", dates)
    .order("date", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    date: r.date as string,
    ...mapBaseMetrics(r),
  }));
}

// ---------------------------------------------------------------------------
// getServiceData (internal)
// ---------------------------------------------------------------------------

/**
 * Fetches service-level daily data from media.v_daily_by_service.
 *
 * Fires one query per date in parallel instead of a single large
 * `.in("date", 90 values)` query. Benefits:
 *  - Each single-date `.eq()` always uses the idx_daily_date index
 *    (the planner never falls back to a slow sequential scan).
 *  - No `count: "exact"` overhead — avoids the LIMIT-less count query
 *    that triggers statement timeouts on GROUP BY views.
 *  - ~90 parallel requests complete in O(1) round-trip time.
 *
 * @param dates     - Date strings to fetch (YYYY-MM-DD[])
 * @param clientIds - If provided, only rows matching these client_ids are returned
 * @returns Array of DailyServiceRow
 * @throws Supabase error if any query fails
 */
export async function getServiceData(
  dates: string[],
  clientIds: string[] | null,
): Promise<DailyServiceRow[]> {
  const supabase = await createMediaClient();

  const SELECT_COLS =
    "date, client_id, client_name, service_id, service_name, " +
    "cost_spent, ad_revenue, imp, vimp, cnt_click";

  function mapRow(r: Record<string, unknown>): DailyServiceRow {
    return {
      date: r.date as string,
      ...mapClientService(r),
      ...mapBaseMetrics(r),
    };
  }

  // Fetch a single date with paginated query.
  async function fetchDate(date: string): Promise<DailyServiceRow[]> {
    return paginateQuery(
      (offset, bs) => {
        let q = supabase
          .from("v_daily_by_service")
          .select(SELECT_COLS)
          .eq("date", date)
          .range(offset, offset + bs - 1);
        if (clientIds && clientIds.length > 0) {
          q = q.in("client_id", clientIds);
        }
        return q as never;
      },
      mapRow,
    );
  }

  // All dates in parallel — each resolves in O(1) index scan
  const results = await Promise.all(dates.map(fetchDate));
  return results.flat();
}

// ---------------------------------------------------------------------------
// getRefWeeks (internal)
// ---------------------------------------------------------------------------

/**
 * Fetches ref_week entries that overlap with the given date range.
 * A week overlaps if date_end >= oldestDate AND date_start <= newestDate.
 *
 * @param oldestDate - Earliest date in the range (YYYY-MM-DD)
 * @param newestDate - Latest date in the range (YYYY-MM-DD)
 * @returns Array of RefWeekRow, ordered newest-first (by date_start desc)
 * @throws Supabase error if the query fails
 */
async function getRefWeeks(
  oldestDate: string,
  newestDate: string,
): Promise<RefWeekRow[]> {
  const supabase = await createMediaClient();

  const { data, error } = await supabase
    .from("ref_week")
    .select("id, year, week_number, date_start, date_end, display_label")
    .gte("date_end", oldestDate)
    .lte("date_start", newestDate)
    .order("date_start", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return (data as Array<{
    id: number;
    year: number;
    week_number: number;
    date_start: string;
    date_end: string;
    display_label: string;
  }>).map((r) => ({
    id: r.id,
    year: r.year,
    week_number: r.week_number,
    date_start: r.date_start,
    date_end: r.date_end,
    display_label: r.display_label,
  }));
}

// ---------------------------------------------------------------------------
// getBoardPayload
// ---------------------------------------------------------------------------

/**
 * Assembles the complete BoardPayload for the Dashboard section.
 *
 * Uses pre-aggregated views for optimal performance:
 *   - v_dates          → 1 query (vs 10-15 with pagination)
 *   - v_daily_total    → 1 query, 90 rows (vs 90-180 queries, 450k rows)
 *   - v_daily_by_service → ~18 queries, ~18k rows
 *
 * @param filters - Global filter values (search, tier, owner)
 * @returns Serializable payload ready to pass to DashboardClient
 * @throws Supabase / network error if any sub-query fails
 */
/**
 * Assembles the fast subset of the board payload.
 *
 * Resolves in ~300ms (3 queries, 90 + 90 rows) — does NOT fetch serviceData.
 * Used for streaming: await this first so KPI cards render immediately,
 * then pass getBoardServiceData() as a Promise for the chart section.
 *
 * @param filters - Global filter values (search, tier, owner)
 * @returns Quick payload including clientIds needed for getBoardServiceData()
 */
export async function getBoardQuickPayload(
  filters: BoardFilters,
): Promise<BoardQuickPayload> {
  const [allDates, clientIds] = await Promise.all([
    getBoardAllDates(90),
    getFilteredClientIds(filters),
  ]);

  if (allDates.length === 0) {
    return { allDates: [], totalData: [], weeks: [], clientIds: null };
  }

  const [totalData, weeks] = await Promise.all([
    getTotalData(allDates),
    getRefWeeks(allDates[allDates.length - 1], allDates[0]),
  ]);

  // Filter allDates to only include dates that have actual totalData rows.
  // v_dates may contain dates not yet present in v_daily_total.
  const totalDateSet = new Set(totalData.map((r) => r.date));
  const validDates = allDates.filter((d) => totalDateSet.has(d));

  return { allDates: validDates, totalData, weeks, clientIds };
}

/**
 * Fetches service-level daily data for the given dates and client filter.
 * Called separately from getBoardQuickPayload() to enable streaming.
 *
 * @param allDates  - Date strings from getBoardQuickPayload().allDates
 * @param clientIds - Filter list from getBoardQuickPayload().clientIds
 * @returns Service-level rows for all dates
 */
export async function getBoardServiceData(
  allDates: string[],
  clientIds: string[] | null,
): Promise<DailyServiceRow[]> {
  return getServiceData(allDates, clientIds);
}

export async function getBoardPayload(
  filters: BoardFilters,
): Promise<BoardPayload> {
  const quick = await getBoardQuickPayload(filters);

  if (quick.allDates.length === 0) {
    return { allDates: [], totalData: [], serviceData: [], weeks: [] };
  }

  const serviceData = await getServiceData(quick.allDates, quick.clientIds);

  return {
    allDates: quick.allDates,
    totalData: quick.totalData,
    serviceData,
    weeks: quick.weeks,
  };
}
