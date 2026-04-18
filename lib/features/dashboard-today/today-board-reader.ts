/**
 * Server-side data fetch for the Today Status Board.
 *
 * 데이터 소스: Supabase media.hourly_snapshot (hourly-sync cron 적재).
 * 범위: 최근 14일 (오늘 + 직전 ~10 영업일 baseline + 버퍼).
 *
 * 호출자: TodayStatusSection (SSR), /api/today-status (브라우저 refetch).
 */

import { createCronSupabase } from "@/lib/supabase/cron-client";
import {
  aggregateHourlyBoard,
  type HourlySnapshotRow,
  type TodayBoard,
} from "./aggregate";

const LOOKBACK_DAYS = 14;

function todayKstDateString(): string {
  const nowUtc = new Date();
  const kstMs = nowUtc.getTime() + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function kstDateMinusDays(base: string, days: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export async function fetchTodayStatus(): Promise<TodayBoard> {
  const today = todayKstDateString();
  const earliest = kstDateMinusDays(today, LOOKBACK_DAYS - 1);

  const supabase = createCronSupabase();
  const { data, error } = await supabase
    .from("hourly_snapshot")
    .select("date_kst,hour_kst,revenue_krw,vimp,cpc,vctr_pct,mfr_pct")
    .gte("date_kst", earliest)
    .lte("date_kst", today)
    .order("date_kst", { ascending: false })
    .order("hour_kst", { ascending: true });

  if (error) {
    throw new Error(`media.hourly_snapshot 조회 실패: ${error.message}`);
  }

  const rows: HourlySnapshotRow[] = (data ?? []).map((r) => ({
    date_kst: r.date_kst,
    hour_kst: r.hour_kst,
    revenue_krw: Number(r.revenue_krw),
    vimp: Number(r.vimp),
    cpc: r.cpc !== null ? Number(r.cpc) : null,
    vctr_pct: r.vctr_pct !== null ? Number(r.vctr_pct) : null,
    mfr_pct: r.mfr_pct !== null ? Number(r.mfr_pct) : null,
  }));

  return aggregateHourlyBoard(rows, today);
}
