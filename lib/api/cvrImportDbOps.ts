/**
 * CVR import DB operations.
 *
 * All functions use the browser Supabase client targeting media.cvr.
 */

import { createMediaClient } from "@/lib/supabase/media-client";
import { BATCH_SIZE } from "@/lib/config";
import type { CvrParsedRow } from "@/lib/utils/cvrCsvParser";
import type { CvrLevel } from "@/lib/utils/calculate-utils";

// ---------------------------------------------------------------------------
// DB row type
// ---------------------------------------------------------------------------

export interface CvrDbRow {
  date: string;
  client_id: string;
  client_name: string | null;
  service_id: string;
  service_name: string | null;
  service_type: string | null;
  level: CvrLevel;
  revenue: number | null;
  vimp: number | null;
  rpm: number | null;
  vctr_pct: number | null;
  cpc: number | null;
  click: number | null;
  campaign_count: number | null;
  normalized_cvr_pct: number | null;
  invalid_revenue_ratio_pct: number | null;
  contribution_margin_rate_pct: number | null;
}

// ---------------------------------------------------------------------------
// Last imported date
// ---------------------------------------------------------------------------

/**
 * Returns the most recent date present in media.cvr.
 *
 * @returns Most recent date string (YYYY-MM-DD), or null if table is empty.
 */
export async function getLastCvrImportedDate(): Promise<string | null> {
  try {
    const supabase = createMediaClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("cvr" as any) as any)
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
// Pre-flight conflict check
// ---------------------------------------------------------------------------

/**
 * Returns which of the given dates already have rows in media.cvr.
 * Used for conflict detection in normal (non-force) import mode.
 *
 * @param dates - Unique date strings (YYYY-MM-DD) to check
 * @returns Array of dates that already exist in the table
 */
export async function checkExistingCvrDates(
  dates: string[]
): Promise<string[]> {
  if (dates.length === 0) return [];

  try {
    const supabase = createMediaClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("cvr" as any) as any)
      .select("date")
      .in("date", dates);

    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = (data as any[])?.map((r: any) => r.date as string) ?? [];
    return [...new Set(existing)]; // deduplicate
  } catch {
    return []; // safe fallback: assume no conflict, let insert fail if needed
  }
}

// ---------------------------------------------------------------------------
// Force-update delete
// ---------------------------------------------------------------------------

/**
 * Deletes all rows in media.cvr within the given date range.
 * Used by force-update mode before re-importing.
 *
 * @param startDate - Inclusive start (YYYY-MM-DD)
 * @param endDate   - Inclusive end (YYYY-MM-DD)
 */
export async function deleteCvrByDateRange(
  startDate: string,
  endDate: string
): Promise<{ deleted: number; error: Error | null }> {
  try {
    const supabase = createMediaClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("cvr" as any) as any)
      .delete()
      .gte("date", startDate)
      .lte("date", endDate)
      .select("date");

    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { deleted: (data as any[])?.length ?? 0, error: null };
  } catch (err) {
    return { deleted: 0, error: err as Error };
  }
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

interface UpsertCvrResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * Upserts CVR rows into media.cvr in batches.
 * Conflict resolution: (date, service_id) → UPDATE.
 *
 * @param rows       - Rows to upsert
 * @param onProgress - Callback with cumulative processed count
 * @param onCancel   - Returns true to stop processing between batches
 */
export async function upsertCvrRows(
  rows: CvrDbRow[],
  onProgress?: (processed: number) => void,
  onCancel?: () => boolean
): Promise<UpsertCvrResult> {
  const result: UpsertCvrResult = { success: 0, failed: 0, errors: [] };
  const supabase = createMediaClient();

  // Deduplicate by (date, service_id) — same batch with duplicate PK causes
  // PostgreSQL error "ON CONFLICT DO UPDATE command cannot affect row a second time".
  const seen = new Set<string>();
  const dedupedRows = rows.filter((r) => {
    const key = `${r.date}|${r.service_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (let i = 0; i < dedupedRows.length; i += BATCH_SIZE) {
    if (onCancel?.()) break;

    const batch = dedupedRows.slice(i, i + BATCH_SIZE);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("cvr" as any) as any)
      .upsert(batch, { onConflict: "date,service_id" });

    if (error) {
      result.failed += batch.length;
      // Log full error object as JSON for diagnosis
      console.error("[upsertCvrRows] batch error:", JSON.stringify(error));
      const detail = (error as any).details ? ` (${(error as any).details})` : "";
      const hint = (error as any).hint ? ` hint: ${(error as any).hint}` : "";
      result.errors.push({ row: i + 1, message: `${error.message}${detail}${hint}` });
    } else {
      result.success += batch.length;
    }

    onProgress?.(Math.min(i + BATCH_SIZE, dedupedRows.length));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Row builder
// ---------------------------------------------------------------------------

/**
 * Converts a CvrParsedRow + computed level into a CvrDbRow ready for upsert.
 */
export function buildCvrDbRow(
  parsed: CvrParsedRow,
  level: CvrLevel
): CvrDbRow {
  return {
    date: parsed.date,
    client_id: parsed.client_id,
    client_name: parsed.client_name,
    service_id: parsed.service_id,
    service_name: parsed.service_name,
    service_type: parsed.service_type,
    level,
    revenue: parsed.revenue,
    vimp: parsed.vimp,
    rpm: parsed.rpm,
    vctr_pct: parsed.vctr_pct,
    cpc: parsed.cpc,
    click: parsed.click,
    campaign_count: parsed.campaign_count,
    normalized_cvr_pct: parsed.normalized_cvr_pct,
    invalid_revenue_ratio_pct: parsed.invalid_revenue_ratio_pct,
    contribution_margin_rate_pct: parsed.contribution_margin_rate_pct,
  };
}
