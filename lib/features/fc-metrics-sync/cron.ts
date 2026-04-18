/**
 * FC metrics cache sync — external_total_daily 도착 시각 관찰 모드 (2026-04-19 실험, 1~2일).
 *
 * 동작:
 *  - 03:00 ~ 10:50 KST, 10분 간격 tick
 *  - target = media.external_total_daily 의 (date = KST D-1) 에 widget row 가 하나라도 있는가
 *  - 매 tick: 이미 존재 → 조용히 skip, 없으면 runFcMetricsSyncJob() 실행 후 재확인
 *
 * 실험 종료 후 원래 "30 7 * * *" 스케줄로 되돌릴 것.
 */

import cron from "node-cron";
import { runFcMetricsSyncJob } from "./job";
import { createCronSupabase } from "@/lib/supabase/cron-client";

const LOG = "[04-media-fc-report-data]";
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
  return `${kstYmd(0)} ${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}:${String(kst.getUTCSeconds()).padStart(2, "0")} KST`;
}

async function hasExternalTotalForDate(date: string): Promise<boolean> {
  const supabase = createCronSupabase();
  const { data, error } = await supabase
    .from("external_total_daily")
    .select("date")
    .eq("date", date)
    .limit(1);
  if (error) throw new Error(`media.external_total_daily 조회 실패: ${error.message}`);
  return (data ?? []).length > 0;
}

export function registerFcMetricsSyncCron(): void {
  if (registered) return;
  registered = true;

  cron.schedule(
    SCHEDULE,
    async () => {
      const t0 = Date.now();
      const target = kstYmd(-1);

      try {
        if (arrivedForDate === target) return;

        const already = await hasExternalTotalForDate(target);
        if (already) {
          if (arrivedForDate !== target) {
            console.log(`${LOG} already present for ${target} (first seen at ${kstNowIso()})`);
            arrivedForDate = target;
          }
          return;
        }

        const result = await runFcMetricsSyncJob();
        const nowHas = await hasExternalTotalForDate(target);
        const base = {
          widgetsChecked: result.widgetsChecked,
          widgetsUpserted: result.widgetsUpserted,
          rowsUpserted: result.rowsUpserted,
          failures: result.failures,
          durationMs: Date.now() - t0,
        };
        if (nowHas) {
          arrivedForDate = target;
          console.log(`${LOG} ARRIVED at ${kstNowIso()} (target=${target})`, base);
        } else {
          console.log(`${LOG} not-yet for ${target} (ran but no data)`, base);
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
