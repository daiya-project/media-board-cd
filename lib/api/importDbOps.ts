/**
 * Import DB operations — simple CRUD queries for CSV data import.
 *
 * All functions use the browser Supabase client and target the `media` schema.
 * Based on _reference/src/shared/api/importService/db.ts.
 */

import { createMediaClient } from "@/lib/supabase/media-client";
import { WIDGET_BATCH_SIZE } from "@/lib/config";
import type { ParsedCSVRow } from "@/types/app-db.types";

// ---------------------------------------------------------------------------
// DB — last imported date
// ---------------------------------------------------------------------------

/**
 * Returns the most recent date present in media.daily.
 * Client-side equivalent of lib/api/dateService.ts getLatestDataDate (server-only).
 *
 * @returns Most recent date string (YYYY-MM-DD), or null if table is empty.
 */
export async function getLastImportedDate(): Promise<string | null> {
  try {
    const supabase = createMediaClient();
    const { data, error } = await supabase
      .from("daily")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // no rows
      throw error;
    }
    return (data?.date as string) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DB — force-update delete
// ---------------------------------------------------------------------------

/**
 * Deletes all rows in media.daily within the given date range.
 * Used by force-update mode before re-importing the same date range.
 *
 * @param startDate - Inclusive start (YYYY-MM-DD)
 * @param endDate   - Inclusive end (YYYY-MM-DD)
 */
export async function deleteDataByDateRange(
  startDate: string,
  endDate: string
): Promise<{ deleted: number; error: Error | null }> {
  try {
    const supabase = createMediaClient();
    const { data, error } = await supabase
      .from("daily")
      .delete()
      .gte("date", startDate)
      .lte("date", endDate)
      .select("date");

    if (error) throw error;
    return { deleted: data?.length ?? 0, error: null };
  } catch (err) {
    console.error("데이터 삭제 오류:", err);
    return { deleted: 0, error: err as Error };
  }
}

// ---------------------------------------------------------------------------
// DB — whitelist validation (client only)
// ---------------------------------------------------------------------------

/**
 * Queries media.client to determine which client_ids actually exist.
 * Used to reject CSV rows referencing unregistered clients before upsert.
 * service_id is NOT checked here — missing services are auto-registered by ensureServicesExist.
 *
 * @param clientIds - Unique client_id values from the CSV
 * @returns Set of client_ids and a name lookup map for those clients
 */
export async function fetchRegisteredClientIds(
  clientIds: string[]
): Promise<{ validClientIds: Set<string>; clientNameMap: Map<string, string> }> {
  const supabase = createMediaClient();
  const validClientIds = new Set<string>();
  const clientNameMap = new Map<string, string>();

  // Query in batches (Supabase .in() has payload limits)
  for (let i = 0; i < clientIds.length; i += WIDGET_BATCH_SIZE) {
    const batch = clientIds.slice(i, i + WIDGET_BATCH_SIZE);
    const { data, error } = await supabase
      .from("client")
      .select("client_id, client_name")
      .in("client_id", batch);

    if (error) throw error;
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of data as any[]) {
        validClientIds.add(row.client_id);
        if (row.client_name) clientNameMap.set(row.client_id, row.client_name);
      }
    }
  }

  return { validClientIds, clientNameMap };
}

// ---------------------------------------------------------------------------
// DB — failed rows
// ---------------------------------------------------------------------------

/**
 * Saves failed import rows to media.daily_failed for audit/retry.
 * Non-fatal: logs errors but does not throw.
 *
 * @param failedRows - Rows that failed validation or upsert
 */
export async function saveFailedRows(
  failedRows: Array<{
    row: ParsedCSVRow;
    normalizedDate: string;
    errorMessage: string;
  }>
): Promise<void> {
  if (failedRows.length === 0) return;

  try {
    const supabase = createMediaClient();
    const insertData = failedRows.map(({ row, normalizedDate, errorMessage }) => ({
      date: normalizedDate || null,
      client_id: row.client_id,
      service_id: row.service_id,
      widget_id: row.widget_id ?? null,
      widget_name: row.widget_name ?? null,
      cost_spent: row.cost_spent || 0,
      pub_profit: row.pub_profit || 0,
      imp: row.imp || 0,
      vimp: row.vimp || 0,
      cnt_click: row.cnt_click || 0,
      cnt_cv: row.cnt_cv || 0,
      error_message: errorMessage,
    }));

    const { error } = await supabase
      .from("daily_failed")
      .insert(insertData);

    if (error) console.error("실패 행 저장 오류:", error);
  } catch (err) {
    console.error("실패 행 저장 중 오류:", err);
  }
}

// ---------------------------------------------------------------------------
// refreshDailyViews
// ---------------------------------------------------------------------------

/**
 * Refreshes the v_daily_total and v_daily_by_service materialized views
 * by calling the media.refresh_daily_views() PostgreSQL function.
 *
 * Called after a successful CSV import to ensure the Board and Data sections
 * reflect the newly imported data on the next page load.
 *
 * Uses REFRESH MATERIALIZED VIEW CONCURRENTLY (no table lock).
 *
 * @throws Supabase error if the RPC call fails
 */
export async function refreshDailyViews(): Promise<void> {
  const supabase = createMediaClient();
  const { error } = await supabase.rpc("refresh_daily_views");
  if (error) throw error;
}
