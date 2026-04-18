/**
 * hourly-sync Supabase upsert + 14일 이전 row 정리.
 *
 * upsert key: (date_kst, hour_kst). 충돌 시 전체 컬럼 갱신.
 * 14일 retention: cron 매 tick 마다 idempotent 정리.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { HourlySnapshotUpsertRow } from "./aggregate";

const UPSERT_BATCH_SIZE = 1000;
const RETENTION_DAYS = 14;

type CronSupabase = SupabaseClient<Database, "media">;

/**
 * media.hourly_snapshot 에 upsert. (date_kst, hour_kst) 충돌 시 전체 컬럼 갱신.
 *
 * @throws Supabase 에러 발생 시.
 */
export async function upsertHourlySnapshot(
  supabase: CronSupabase,
  rows: HourlySnapshotUpsertRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from("hourly_snapshot")
      .upsert(batch, { onConflict: "date_kst,hour_kst" });
    if (error) {
      throw new Error(`hourly_snapshot upsert 실패: ${error.message}`);
    }
    upserted += batch.length;
  }
  return upserted;
}

function kstDateMinusDays(days: number): string {
  const nowUtc = new Date();
  const kstMs = nowUtc.getTime() + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  d.setUTCDate(d.getUTCDate() - days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * `오늘 KST - RETENTION_DAYS` 이전 row 삭제. idempotent (대상 0건이면 no-op).
 *
 * @throws Supabase 에러 발생 시.
 */
export async function deleteOlderThan14Days(
  supabase: CronSupabase,
): Promise<number> {
  const cutoff = kstDateMinusDays(RETENTION_DAYS);

  const { count: toDelete, error: countError } = await supabase
    .from("hourly_snapshot")
    .select("*", { count: "exact", head: true })
    .lt("date_kst", cutoff);
  if (countError) {
    throw new Error(`hourly_snapshot cleanup count 실패: ${countError.message}`);
  }
  if (!toDelete) return 0;

  const { error: delError } = await supabase
    .from("hourly_snapshot")
    .delete()
    .lt("date_kst", cutoff);
  if (delError) {
    throw new Error(`hourly_snapshot cleanup 실패: ${delError.message}`);
  }
  return toDelete;
}
