/**
 * Goal Monthly service — data for the monthly goal dashboard.
 *
 * Sources:
 *   - media.v_monthly MV for historical monthly aggregates
 *   - media.daily for current month in-progress data (MV may be stale)
 *   - media.client for manager filtering
 */

import { createMediaClient } from "@/lib/supabase/media-server";
import { getLatestDataDate } from "@/lib/api/dateService";
import { paginateQuery } from "@/lib/api/paginateQuery";
import { toYearMonth, parseYearMonth, addMonths, getDaysInMonth } from "@/lib/utils/date-utils";
import type {
  MonthlyKpiCard,
  ClientMonthlyVimpRow,
} from "@/types/app-db.types";
import {
  buildKpiCards,
  buildCumulativeChart,
  calcProjectedVimp,
} from "@/lib/logic/goalLogic";
import type { CumulativeChartPoint } from "@/lib/logic/goalLogic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns an array of 13 month keys ending at the given month (newest → oldest).
 */
function getLast13Months(currentMonthKey: string): string[] {
  const months: string[] = [];
  for (let i = 0; i < 13; i++) {
    months.push(addMonths(currentMonthKey, -i));
  }
  return months;
}

/**
 * Gets client_ids for a given manager.
 * Returns null if no managerId filter (= all clients).
 */
async function getClientIdsForManager(
  supabase: ReturnType<Awaited<ReturnType<typeof createMediaClient>>>,
  managerId: number | null | undefined,
): Promise<string[] | null> {
  if (!managerId) return null;

  const { data: clients, error } = await supabase
    .from("client")
    .select("client_id")
    .eq("manager_id", managerId);

  if (error) throw error;
  return ((clients ?? []) as { client_id: string }[]).map((c) => c.client_id);
}

/**
 * Fetches current month vimp from media.daily (not MV).
 * This ensures we always have up-to-date data for the current month
 * even when the MV hasn't been refreshed.
 */
async function getCurrentMonthDailyVimp(
  supabase: ReturnType<Awaited<ReturnType<typeof createMediaClient>>>,
  currentMonthKey: string,
  clientIds: string[] | null,
): Promise<Map<string, { vimp: number; clientName: string }>> {
  const monthStart = `${currentMonthKey}-01`;
  const [y, m] = parseYearMonth(currentMonthKey);
  const lastDay = getDaysInMonth(y, m);
  const monthEnd = `${currentMonthKey}-${String(lastDay).padStart(2, "0")}`;

  const rows = await paginateQuery(
    (offset, batchSize) => {
      let q = supabase
        .from("v_daily")
        .select("date, client_id, client_name, vimp")
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .range(offset, offset + batchSize - 1);

      if (clientIds) q = q.in("client_id", clientIds);
      return q;
    },
    (row) => ({
      client_id: String(row.client_id),
      client_name: row.client_name as string,
      vimp: Number(row.vimp ?? 0),
    }),
  );

  // Aggregate by client
  const result = new Map<string, { vimp: number; clientName: string }>();
  for (const row of rows) {
    const existing = result.get(row.client_id);
    if (existing) {
      existing.vimp += row.vimp;
    } else {
      result.set(row.client_id, {
        vimp: row.vimp,
        clientName: row.client_name,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// KPI Cards
// ---------------------------------------------------------------------------

/**
 * Builds 4 KPI cards for the Goal Monthly page.
 *
 * @param managerId - optional manager filter (null = all)
 * @returns Array of 4 MonthlyKpiCard
 */
export async function getMonthlyKpiCards(
  managerId?: number | null,
): Promise<MonthlyKpiCard[]> {
  const supabase = await createMediaClient();
  const latestDate = await getLatestDataDate();
  if (!latestDate) throw new Error("No data dates found");

  const currentMonthKey = toYearMonth(latestDate);
  const [year, month] = parseYearMonth(currentMonthKey);

  // Build start key for 2 months ago
  const startKey = addMonths(currentMonthKey, -2);

  // Get filtered client IDs if manager filter
  const clientIds = await getClientIdsForManager(supabase, managerId);
  if (clientIds && clientIds.length === 0) {
    return buildKpiCards(new Map(), currentMonthKey, 0, getDaysInMonth(year, month));
  }

  // Previous month key (for MV query — exclude current month which may be stale)
  const prevMonthKey = addMonths(currentMonthKey, -1);

  // Query v_monthly for past months (MV — reliable for completed months)
  let mvQuery = supabase
    .from("v_monthly")
    .select("year_month, client_id, vimp")
    .gte("year_month", startKey)
    .lte("year_month", prevMonthKey);

  if (clientIds) mvQuery = mvQuery.in("client_id", clientIds);

  const { data: mvData, error: mvErr } = await mvQuery;
  if (mvErr) throw mvErr;

  // Aggregate vimp per month from MV
  const monthlyVimp = new Map<string, number>();
  for (const row of (mvData ?? []) as {
    year_month: string;
    client_id: string;
    vimp: number;
  }[]) {
    const key = row.year_month;
    monthlyVimp.set(key, (monthlyVimp.get(key) ?? 0) + (row.vimp ?? 0));
  }

  // Current month: always use daily table for fresh data
  const currentDailyVimp = await getCurrentMonthDailyVimp(
    supabase,
    currentMonthKey,
    clientIds,
  );
  let currentMonthTotal = 0;
  for (const entry of currentDailyVimp.values()) {
    currentMonthTotal += entry.vimp;
  }
  if (currentMonthTotal > 0) {
    monthlyVimp.set(currentMonthKey, currentMonthTotal);
  }

  // Calculate elapsed days in current month
  const dayOfMonth = Number(latestDate.split("-")[2]);
  const totalDaysInMonth = getDaysInMonth(year, month);

  return buildKpiCards(monthlyVimp, currentMonthKey, dayOfMonth, totalDaysInMonth);
}

// ---------------------------------------------------------------------------
// Client Monthly Vimp Table (13 months)
// ---------------------------------------------------------------------------

/**
 * Fetches per-client monthly vIMP for 13 months.
 *
 * @param managerId - optional manager filter
 * @returns Array of ClientMonthlyVimpRow sorted by current month vimp desc
 */
export async function getClientMonthlyVimp(
  managerId?: number | null,
): Promise<{ months: string[]; rows: ClientMonthlyVimpRow[] }> {
  const supabase = await createMediaClient();
  const latestDate = await getLatestDataDate();
  if (!latestDate) throw new Error("No data dates found");

  const currentMonthKey = toYearMonth(latestDate);
  const monthKeys = getLast13Months(currentMonthKey);
  const oldestMonth = monthKeys[monthKeys.length - 1];

  // Get filtered client IDs if manager filter
  const clientIds = await getClientIdsForManager(supabase, managerId);
  if (clientIds && clientIds.length === 0) {
    return { months: monthKeys, rows: [] };
  }

  // Paginate v_monthly for past months
  const allRows = await paginateQuery(
    (offset, batchSize) => {
      let q = supabase
        .from("v_monthly")
        .select("year_month, client_id, client_name, vimp")
        .gte("year_month", oldestMonth)
        .lte("year_month", currentMonthKey)
        .range(offset, offset + batchSize - 1);

      if (clientIds) q = q.in("client_id", clientIds);
      return q;
    },
    (row) => ({
      year_month: row.year_month as string,
      client_id: String(row.client_id),
      client_name: row.client_name as string,
      vimp: Number(row.vimp ?? 0),
    }),
  );

  // Also fetch current month from daily for freshness
  const currentDailyVimp = await getCurrentMonthDailyVimp(
    supabase,
    currentMonthKey,
    clientIds,
  );

  // Group by client
  const clientMap = new Map<
    string,
    { client_name: string; monthVimp: Map<string, number> }
  >();

  for (const row of allRows) {
    if (!clientMap.has(row.client_id)) {
      clientMap.set(row.client_id, {
        client_name: row.client_name,
        monthVimp: new Map(),
      });
    }
    const entry = clientMap.get(row.client_id)!;
    entry.monthVimp.set(
      row.year_month,
      (entry.monthVimp.get(row.year_month) ?? 0) + row.vimp,
    );
  }

  // Merge current month daily data (override MV which may be stale)
  for (const [clientId, daily] of currentDailyVimp) {
    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        client_name: daily.clientName,
        monthVimp: new Map(),
      });
    }
    clientMap.get(clientId)!.monthVimp.set(currentMonthKey, daily.vimp);
  }

  // Calculate projection for current month
  const dayOfMonth = Number(latestDate.split("-")[2]);
  const [y, m] = parseYearMonth(currentMonthKey);
  const totalDays = getDaysInMonth(y, m);

  // Build rows
  const result: ClientMonthlyVimpRow[] = [];
  for (const [clientId, entry] of clientMap) {
    const monthValues = monthKeys.map((mk) => entry.monthVimp.get(mk) ?? 0);
    const currentVimp = entry.monthVimp.get(currentMonthKey) ?? 0;

    result.push({
      client_id: clientId,
      client_name: entry.client_name,
      projectedVimp:
        currentVimp > 0
          ? calcProjectedVimp(currentVimp, dayOfMonth, totalDays)
          : null,
      months: monthValues,
    });
  }

  // Sort by current month vimp desc
  result.sort((a, b) => b.months[0] - a.months[0]);

  return { months: monthKeys, rows: result };
}

// ---------------------------------------------------------------------------
// Cumulative Chart Data
// ---------------------------------------------------------------------------

/**
 * Fetches daily vimp for the current month and builds cumulative chart data.
 *
 * @param managerId - optional manager filter
 * @param monthGoal - team/manager monthly vimp goal (0 if not set)
 * @returns Cumulative chart points for the current month
 */
export async function getCumulativeChartData(
  managerId?: number | null,
  monthGoal?: number,
): Promise<{ chartPoints: CumulativeChartPoint[]; currentMonthKey: string }> {
  const supabase = await createMediaClient();
  const latestDate = await getLatestDataDate();
  if (!latestDate) throw new Error("No data dates found");

  const currentMonthKey = toYearMonth(latestDate);
  const [y, m] = parseYearMonth(currentMonthKey);
  const totalDays = getDaysInMonth(y, m);
  const latestDay = Number(latestDate.split("-")[2]);

  const clientIds = await getClientIdsForManager(supabase, managerId);
  if (clientIds && clientIds.length === 0) {
    return {
      chartPoints: buildCumulativeChart(new Map(), totalDays, 0, monthGoal ?? 0),
      currentMonthKey,
    };
  }

  const monthStart = `${currentMonthKey}-01`;

  // Fetch daily vimp grouped by date
  const rows = await paginateQuery(
    (offset, batchSize) => {
      let q = supabase
        .from("v_daily")
        .select("date, vimp")
        .gte("date", monthStart)
        .lte("date", latestDate)
        .range(offset, offset + batchSize - 1);

      if (clientIds) q = q.in("client_id", clientIds);
      return q;
    },
    (row) => ({
      date: row.date as string,
      vimp: Number(row.vimp ?? 0),
    }),
  );

  // Aggregate by day-of-month
  const dailyVimp = new Map<number, number>();
  for (const row of rows) {
    const day = Number(row.date.split("-")[2]);
    dailyVimp.set(day, (dailyVimp.get(day) ?? 0) + row.vimp);
  }

  const chartPoints = buildCumulativeChart(
    dailyVimp,
    totalDays,
    latestDay,
    monthGoal ?? 0,
  );

  return { chartPoints, currentMonthKey };
}
