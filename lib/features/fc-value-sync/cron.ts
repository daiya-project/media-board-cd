/**
 * FC value sync — DW FC snapshot 도착 시각 관찰 모드 (2026-04-19 실험, 1~2일).
 *
 * 동작:
 *  - 03:00 ~ 10:50 KST, 10분 간격 tick
 *  - 매 tick: arrivedForDate 플래그 확인 → 오늘 이미 도착 표시면 skip
 *  - 도착 판정: runFcValueSyncJob() 실행 후 result.fcPrefetched > 0 이면 DW 가 오늘치 snapshot 을
 *    준비한 것으로 간주 (price 가 변동되지 않아 widgetsInserted = 0 여도 "도착"으로 집계)
 *
 * 주의: 이 job 의 결과만으로는 DB 에 "오늘 처리됨" 흔적이 남지 않는 경우가 많아
 * (diff 0 이면 insert 0), in-memory 플래그로만 중복 실행을 막는다. Pod 재시작 시
 * 플래그는 리셋되지만 job 자체는 idempotent (diff 기반 insert) 라 안전하다.
 *
 * 실험 종료 후 원래 "0 7 * * *" 스케줄로 되돌릴 것.
 */

import cron from "node-cron";
import { runFcValueSyncJob } from "./job";

const LOG = "[03-media-fc-cpm-sync]";
const SCHEDULE = "*/10 3-10 * * *";

let registered = false;
/** 오늘 (KST) 이미 도착 로깅을 마쳤으면 그 날짜. 이후 tick 은 skip. */
let arrivedForDate: string | null = null;

function kstYmd(): string {
  const utc = new Date();
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

function kstNowIso(): string {
  const utc = new Date();
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return `${kstYmd()} ${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}:${String(kst.getUTCSeconds()).padStart(2, "0")} KST`;
}

export function registerFcValueSyncCron(): void {
  if (registered) return;
  registered = true;

  cron.schedule(
    SCHEDULE,
    async () => {
      const t0 = Date.now();
      const today = kstYmd();

      try {
        if (arrivedForDate === today) return;

        const result = await runFcValueSyncJob();
        const base = {
          widgetsChecked: result.widgetsChecked,
          widgetsInserted: result.widgetsInserted,
          fcPrefetched: result.fcPrefetched,
          fcResolved: result.fcResolved,
          failures: result.failures,
          durationMs: Date.now() - t0,
        };

        if (result.fcPrefetched > 0) {
          arrivedForDate = today;
          console.log(`${LOG} ARRIVED at ${kstNowIso()} (target=${today})`, base);
        } else {
          console.log(`${LOG} not-yet for ${today} (DW snapshot empty)`, base);
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
