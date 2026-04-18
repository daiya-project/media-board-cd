/**
 * Daily Redash import — 데이터 도착 시각 관찰 모드 (2026-04-19 실험, 1~2일).
 *
 * 동작:
 *  - 03:00 ~ 10:50 KST, 10분 간격 tick
 *  - 매 tick: media.daily 에 target date (KST D-1) row 존재 여부 확인
 *    · 이미 존재 → 조용히 skip (첫 도착 때 한 번만 ARRIVED 로그)
 *    · 없으면 runDailyImportJob({ mode: 'incremental' }) 실행 후 재확인
 *      · 이번 tick 에서 row 가 생기면 ARRIVED + 시각 로그
 *      · 여전히 없으면 not-yet 로그 (다음 tick 에서 재시도)
 *
 * 실험 목적: Redash 소스 테이블에 전일 데이터가 몇 시 몇 분에 준비되는지 측정.
 * 실험 종료 후 원래 "0 6 * * *" 스케줄로 되돌릴 것.
 *
 * 단일 리플리카 가정. HPA 시 분산 lock 필요.
 */

import cron from "node-cron";
import { runDailyImportJob } from "./job";
import { createCronSupabase } from "@/lib/supabase/cron-client";

const LOG = "[01-media-daily-data]";
const SCHEDULE = "*/10 3-10 * * *";

let registered = false;
let arrivedForDate: string | null = null;

function kstYmd(offsetDays: number): string {
  const utc = new Date();
  const kst = new Date(utc.getTime() + (9 + offsetDays * 24) * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

function kstNowIso(): string {
  const utc = new Date();
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")} ${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}:${String(kst.getUTCSeconds()).padStart(2, "0")} KST`;
}

async function hasDailyForDate(date: string): Promise<boolean> {
  const supabase = createCronSupabase();
  const { data, error } = await supabase
    .from("daily")
    .select("date")
    .eq("date", date)
    .limit(1);
  if (error) throw new Error(`media.daily 조회 실패: ${error.message}`);
  return (data ?? []).length > 0;
}

export function registerDailyImportCron(): void {
  if (registered) return;
  registered = true;

  cron.schedule(
    SCHEDULE,
    async () => {
      const t0 = Date.now();
      const target = kstYmd(-1);

      try {
        if (arrivedForDate === target) return;

        const already = await hasDailyForDate(target);
        if (already) {
          if (arrivedForDate !== target) {
            console.log(`${LOG} already present for ${target} (first seen at ${kstNowIso()})`);
            arrivedForDate = target;
          }
          return;
        }

        const result = await runDailyImportJob({ mode: "incremental" });
        const nowHas = await hasDailyForDate(target);
        if (nowHas) {
          arrivedForDate = target;
          console.log(`${LOG} ARRIVED at ${kstNowIso()} (target=${target})`, {
            ...result,
            durationMs: Date.now() - t0,
          });
        } else {
          console.log(`${LOG} not-yet for ${target} (ran but no data)`, {
            ...result,
            durationMs: Date.now() - t0,
          });
        }
      } catch (err) {
        console.error(`${LOG} failed`, {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          durationMs: Date.now() - t0,
        });
      }
    },
    { timezone: "Asia/Seoul" },
  );

  console.log(`${LOG} registered (${SCHEDULE} Asia/Seoul)`);
}
