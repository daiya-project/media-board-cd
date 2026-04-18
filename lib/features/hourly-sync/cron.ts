/**
 * hourly-sync — 시간대별 데이터 도착 시각 관찰 모드 (2026-04-19 실험, 1~2일).
 *
 * 동작:
 *  - 매시 :00 / :05 / :10 KST tick (총 3회/시간)
 *  - target = "방금 끝난 hour" = (현재 KST 시각 기준 1시간 전의 hour_kst)
 *  - 매 tick: media.hourly_snapshot 에 (date_kst, hour_kst = target) row 존재 여부 확인
 *    · 이미 존재 → 조용히 skip
 *    · 없으면 runHourlySyncJob() 실행 후 재확인
 *      · 이번 tick 에서 row 생성 → ARRIVED + 시각 로그
 *      · 여전히 없음 → not-yet 로그 (:10 이후 다음 hour 의 :00 까지 재시도 없음)
 *
 * 실험 목적: Redash Trino 소스 테이블에 직전 hour 데이터가 hour 종료 후 몇 분 만에 가용한지 측정.
 * 실험 종료 후 원래 "20,50 * * * *" 스케줄로 되돌릴 것.
 */

import cron from "node-cron";
import { runHourlySyncJob } from "./job";
import { createCronSupabase } from "@/lib/supabase/cron-client";

const LOG = "[02-media-hourly-data]";
const SCHEDULE = "0,5,10 * * * *";

let registered = false;
/** 마지막으로 ARRIVED 로그를 남긴 (date_kst, hour_kst) 조합. 중복 로그 방지. */
let arrivedFor: { date: string; hour: number } | null = null;

/** 지금 KST 시각 기준 "방금 끝난 hour" — (date_kst, hour_kst). 00시 tick 이면 전일 23시. */
function prevHourKst(): { date: string; hour: number; nowIso: string } {
  const utc = new Date();
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  const prev = new Date(kst.getTime() - 60 * 60 * 1000);
  const date = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
  const hour = prev.getUTCHours();
  const nowIso = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")} ${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}:${String(kst.getUTCSeconds()).padStart(2, "0")} KST`;
  return { date, hour, nowIso };
}

async function hasHourlySnapshot(date: string, hour: number): Promise<boolean> {
  const supabase = createCronSupabase();
  const { data, error } = await supabase
    .from("hourly_snapshot")
    .select("hour_kst")
    .eq("date_kst", date)
    .eq("hour_kst", hour)
    .limit(1);
  if (error) throw new Error(`media.hourly_snapshot 조회 실패: ${error.message}`);
  return (data ?? []).length > 0;
}

export function registerHourlySyncCron(): void {
  if (registered) return;
  registered = true;

  cron.schedule(
    SCHEDULE,
    async () => {
      const t0 = Date.now();
      const { date: targetDate, hour: targetHour, nowIso } = prevHourKst();

      try {
        if (arrivedFor && arrivedFor.date === targetDate && arrivedFor.hour === targetHour) return;

        const already = await hasHourlySnapshot(targetDate, targetHour);
        if (already) {
          console.log(`${LOG} already present for ${targetDate} ${String(targetHour).padStart(2, "0")}시 (first seen at ${nowIso})`);
          arrivedFor = { date: targetDate, hour: targetHour };
          return;
        }

        const result = await runHourlySyncJob();
        const nowHas = await hasHourlySnapshot(targetDate, targetHour);
        if (nowHas) {
          arrivedFor = { date: targetDate, hour: targetHour };
          console.log(`${LOG} ARRIVED at ${nowIso} (target=${targetDate} ${String(targetHour).padStart(2, "0")}시)`, {
            ...result,
            durationMs: Date.now() - t0,
          });
        } else {
          console.log(`${LOG} not-yet for ${targetDate} ${String(targetHour).padStart(2, "0")}시 (ran but no data)`, {
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
