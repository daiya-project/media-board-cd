/**
 * hourly-sync job 오케스트레이션.
 *
 * 호출자:
 *  - cron.ts (자동, 매시 :20 / :50 KST)
 *  - app/api/hourly-sync/route.ts (수동 backfill — Bearer INTERNAL_IMPORT_TOKEN)
 *
 * 흐름:
 *  1. cookie-free Supabase 클라이언트 생성
 *  2. KST date 범위 결정 (default = today - 13일 ~ today, 14일 retention 커버)
 *  3. Redash ad-hoc 1회 호출 → Trino row[]
 *  4. aggregate (미래 시간 skip + 비율 재계산) → upsert row[]
 *  5. media.hourly_snapshot upsert (onConflict date_kst,hour_kst)
 *  6. 14일 이전 row 정리
 *
 * 예외는 호출자(cron 래퍼 / API route) 가 처리.
 */

import { createCronSupabase } from "@/lib/supabase/cron-client";
import { fetchHourlySnapshot } from "./redash-fetch";
import { buildUpsertRows } from "./aggregate";
import { upsertHourlySnapshot, deleteOlderThan14Days } from "./upsert";

const DEFAULT_LOOKBACK_DAYS = 13;

export interface HourlySyncOptions {
  /** YYYY-MM-DD KST inclusive. 생략 시 today - 13일. */
  dateStart?: string;
  /** YYYY-MM-DD KST inclusive. 생략 시 today. */
  dateEnd?: string;
}

export interface HourlySyncResult {
  range: { dateStart: string; dateEnd: string };
  trinoRows: number;
  upsertedRows: number;
  deletedRows: number;
  skippedFutureRows: number;
  durationMs: number;
}

function todayKst(now: Date = new Date()): string {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function kstDateMinusDays(base: string, days: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export async function runHourlySyncJob(
  opts: HourlySyncOptions = {},
): Promise<HourlySyncResult> {
  const t0 = Date.now();
  const dateEnd = opts.dateEnd ?? todayKst();
  const dateStart = opts.dateStart ?? kstDateMinusDays(dateEnd, DEFAULT_LOOKBACK_DAYS);

  const trinoRows = await fetchHourlySnapshot(dateStart, dateEnd);
  const rows = buildUpsertRows(trinoRows);

  const supabase = createCronSupabase();
  const upsertedRows = await upsertHourlySnapshot(supabase, rows);
  const deletedRows = await deleteOlderThan14Days(supabase);

  return {
    range: { dateStart, dateEnd },
    trinoRows: trinoRows.length,
    upsertedRows,
    deletedRows,
    skippedFutureRows: trinoRows.length - rows.length,
    durationMs: Date.now() - t0,
  };
}
