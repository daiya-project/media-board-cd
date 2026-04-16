/**
 * Import batch upsert — batch insert/upsert into media.daily.
 *
 * Handles batch upsert with automatic row-by-row fallback on failure.
 */

import { createMediaClient } from "@/lib/supabase/media-client";
import type { ValidatedRow } from "@/lib/logic/importValidation";

// ---------------------------------------------------------------------------
// Batch upsert
// ---------------------------------------------------------------------------

/**
 * Inserts a batch of validated rows into media.daily.
 * Rows that already exist (same PK) are silently skipped (ON CONFLICT DO NOTHING).
 * Falls back to row-by-row inserts when the batch insert fails.
 */
export async function importBatch(rows: ValidatedRow[]): Promise<{
  success: number;
  failed: number;
  errors: Array<{ index: number; message: string }>;
}> {
  if (rows.length === 0) return { success: 0, failed: 0, errors: [] };

  const supabase = createMediaClient();
  const batchData = rows.map(({ row, normalizedDate }) => ({
    date: normalizedDate,
    client_id: row.client_id!,
    service_id: row.service_id!,
    widget_id: row.widget_id ?? null,
    widget_name: row.widget_name ?? null,
    cost_spent: row.cost_spent || 0,
    pub_profit: row.pub_profit || 0,
    imp: row.imp || 0,
    vimp: row.vimp || 0,
    cnt_click: row.cnt_click || 0,
    cnt_cv: row.cnt_cv || 0,
  }));

  try {
    const { error } = await supabase
      .from("daily")
      .upsert(batchData, {
        onConflict: "date,client_id,service_id,widget_id",
        ignoreDuplicates: true,
      });

    if (error) throw error;
    return { success: rows.length, failed: 0, errors: [] };
  } catch {
    // Fallback: row-by-row insert
    return importBatchFallback(rows);
  }
}

// ---------------------------------------------------------------------------
// Row-by-row fallback (ON CONFLICT DO NOTHING)
// ---------------------------------------------------------------------------

async function importBatchFallback(rows: ValidatedRow[]): Promise<{
  success: number;
  failed: number;
  errors: Array<{ index: number; message: string }>;
}> {
  const supabase = createMediaClient();
  let success = 0;
  let failed = 0;
  const errors: Array<{ index: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const { row, normalizedDate } = rows[i];
    try {
      const { error } = await supabase
        .from("daily")
        .upsert(
          {
            date: normalizedDate,
            client_id: row.client_id!,
            service_id: row.service_id!,
            widget_id: row.widget_id ?? null,
            widget_name: row.widget_name ?? null,
            cost_spent: row.cost_spent || 0,
            pub_profit: row.pub_profit || 0,
            imp: row.imp || 0,
            vimp: row.vimp || 0,
            cnt_click: row.cnt_click || 0,
            cnt_cv: row.cnt_cv || 0,
          },
          { onConflict: "date,client_id,service_id,widget_id", ignoreDuplicates: true }
        );

      if (error) {
        failed++;
        errors.push({ index: i, message: error.message });
      } else {
        success++;
      }
    } catch (err) {
      failed++;
      errors.push({
        index: i,
        message: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    }
  }

  return { success, failed, errors };
}
