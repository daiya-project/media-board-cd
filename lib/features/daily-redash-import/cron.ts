/**
 * Daily Redash import 의 node-cron 스케줄러 등록.
 *
 * - 매일 06:00 KST 에 runDailyImportJob({ mode: 'incremental' }) 실행
 * - 예외는 전부 catch 해 로깅만 — 다음 날 재시도 (gap recovery 가 보충)
 * - registerDailyImportCron() 은 여러 번 호출되어도 1회만 등록 (dev hot-reload 대비)
 *
 * 단일 리플리카 (replicas: 1, hpa_enabled: false) 가정. HPA 활성 시 인스턴스마다
 * 중복 실행되므로 lock 도입 필요.
 */

import cron from "node-cron";
import { runDailyImportJob } from "./job";

let registered = false;

export function registerDailyImportCron(): void {
  if (registered) return;
  registered = true;

  cron.schedule(
    "0 6 * * *",
    async () => {
      const t0 = Date.now();
      try {
        const result = await runDailyImportJob({ mode: "incremental" });
        console.log("[daily-redash-import] ok", {
          ...result,
          durationMs: Date.now() - t0,
        });
      } catch (err) {
        console.error("[daily-redash-import] failed", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          durationMs: Date.now() - t0,
        });
      }
    },
    { timezone: "Asia/Seoul" },
  );

  console.log("[daily-redash-import] registered (0 6 * * * Asia/Seoul)");
}
