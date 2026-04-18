/**
 * hourly-sync node-cron 등록.
 *
 * - 매시 :20 / :50 KST 두 번 실행 (반영 지연 ~30분 이내)
 *   · :20 — 정시 직후 Trino partition 완성 대기 + 직전 hour 데이터 확보
 *   · :50 — 같은 hour 후반 ETL 재수정 / 뒤늦은 집계 재동기화
 * - 콜백 안 최상위 try/catch — Pod crash 방지
 * - registered 플래그 idempotent — dev hot-reload 다중 호출 시에도 1회 등록
 *
 * 단일 리플리카 (replicas: 1, hpa_enabled: false) 가정. HPA 활성 시 분산 lock 도입 필요.
 */

import cron from "node-cron";
import { runHourlySyncJob } from "./job";

const CRON_EXPR = "20,50 * * * *";

let registered = false;

export function registerHourlySyncCron(): void {
  if (registered) return;
  registered = true;

  cron.schedule(
    CRON_EXPR,
    async () => {
      const t0 = Date.now();
      try {
        const result = await runHourlySyncJob();
        console.log("[hourly-sync] ok", {
          ...result,
          durationMs: Date.now() - t0,
        });
      } catch (err) {
        console.error("[hourly-sync] failed", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          durationMs: Date.now() - t0,
        });
      }
    },
    { timezone: "Asia/Seoul" },
  );

  console.log(`[hourly-sync] registered (${CRON_EXPR} Asia/Seoul)`);
}
