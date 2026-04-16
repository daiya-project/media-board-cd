/**
 * Import DB operations — simple CRUD queries for CSV/Redash data import.
 *
 * 모든 함수가 `supabase` 인자를 받는다 — 호출자가 적절한 클라이언트(브라우저/cron)를 주입.
 * 기존에는 내부에서 createMediaClient() 를 호출했으나, cron 에서도 호출 가능하도록 변경.
 */

import { WIDGET_BATCH_SIZE } from "@/lib/config";
import type { ParsedCSVRow } from "@/types/app-db.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type MediaClient = SupabaseClient<Database, "media">;

// ---------------------------------------------------------------------------
// DB — last imported date
// ---------------------------------------------------------------------------

export async function getLastImportedDate(supabase: MediaClient): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("daily")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
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

export async function deleteDataByDateRange(
  supabase: MediaClient,
  startDate: string,
  endDate: string,
): Promise<{ deleted: number; error: Error | null }> {
  try {
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

export async function fetchRegisteredClientIds(
  supabase: MediaClient,
  clientIds: string[],
): Promise<{ validClientIds: Set<string>; clientNameMap: Map<string, string> }> {
  const validClientIds = new Set<string>();
  const clientNameMap = new Map<string, string>();

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

/** media.client 테이블의 모든 client_id 를 반환 (cron 에서 화이트리스트 빌드용). */
export async function fetchAllClientIds(supabase: MediaClient): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("client")
      .select("client_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of data as any[]) ids.push(row.client_id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

// ---------------------------------------------------------------------------
// DB — failed rows
// ---------------------------------------------------------------------------

export async function saveFailedRows(
  supabase: MediaClient,
  failedRows: Array<{
    row: ParsedCSVRow;
    normalizedDate: string;
    errorMessage: string;
  }>,
): Promise<void> {
  if (failedRows.length === 0) return;

  try {
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

    const { error } = await supabase.from("daily_failed").insert(insertData);
    if (error) console.error("실패 행 저장 오류:", error);
  } catch (err) {
    console.error("실패 행 저장 중 오류:", err);
  }
}

// ---------------------------------------------------------------------------
// refreshDailyViews
// ---------------------------------------------------------------------------

export async function refreshDailyViews(supabase: MediaClient): Promise<void> {
  const { error } = await supabase.rpc("refresh_daily_views");
  if (error) throw error;
}
